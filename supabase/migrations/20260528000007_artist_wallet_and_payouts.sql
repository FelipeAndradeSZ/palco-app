-- =========================================================================
-- Migração: Carteira, Saldo e Saques do Artista (PIX) — 2026-05-28
-- =========================================================================

-- 1. Enum de Transações: Adição de 'withdrawal' (saque)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'transaction_type' AND e.enumlabel = 'withdrawal'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'withdrawal';
  END IF;
END
$$;

-- 2. Tabela de Solicitações de Saque (payouts/withdrawals)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CONSTRAINT withdrawal_min_amount CHECK (amount >= 10.00),
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CONSTRAINT withdrawal_status_check CHECK (status IN ('pending', 'completed', 'rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Habilitar RLS na tabela de saques
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para withdrawal_requests
DROP POLICY IF EXISTS "Users can read own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can read own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can insert own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can insert own withdrawal requests"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- 3. Triggers para Débito e Reembolso Automático de Pedidos Musicais (Escrow)
CREATE OR REPLACE FUNCTION public.on_song_request_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o pedido tem valor de recompensa (bounty)
  IF NEW.bounty_value > 0 THEN
    -- Debitar do saldo do ouvinte
    UPDATE public.wallets
      SET balance = balance - NEW.bounty_value
      WHERE profile_id = NEW.requester_id
        AND balance >= NEW.bounty_value;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Saldo insuficiente para realizar o pedido musical (Saldo necessário: R$ %)', NEW.bounty_value;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_on_song_request_created ON public.song_requests;
CREATE TRIGGER tr_on_song_request_created
  BEFORE INSERT ON public.song_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_song_request_created();


CREATE OR REPLACE FUNCTION public.on_song_request_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status mudou de pending para cancelled/rejected, reembolsar o solicitante
  IF OLD.status = 'pending' AND NEW.status = 'cancelled' AND OLD.bounty_value > 0 THEN
    UPDATE public.wallets
      SET balance = balance + OLD.bounty_value
      WHERE profile_id = OLD.requester_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_on_song_request_updated ON public.song_requests;
CREATE TRIGGER tr_on_song_request_updated
  AFTER UPDATE ON public.song_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_song_request_updated();

-- 4. RPCs Financeiros (Withdrawals)
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount numeric,
  p_pix_key text
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_amount < 10.00 THEN
    RAISE EXCEPTION 'O valor mínimo para saque é R$ 10,00';
  END IF;

  IF p_amount > 5000.00 THEN
    RAISE EXCEPTION 'O valor máximo por saque é R$ 5.000,00';
  END IF;

  IF p_pix_key IS NULL OR length(trim(p_pix_key)) = 0 THEN
    RAISE EXCEPTION 'A chave PIX é obrigatória para o saque';
  END IF;

  -- Debitar da carteira do usuário
  UPDATE public.wallets
    SET balance = balance - p_amount
    WHERE profile_id = auth.uid()
      AND balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo insuficiente para realizar o saque';
  END IF;

  -- Inserir o pedido de saque
  INSERT INTO public.withdrawal_requests (profile_id, amount, pix_key, status)
  VALUES (auth.uid(), p_amount, trim(p_pix_key), 'pending');

  -- Buscar novo saldo
  SELECT balance INTO v_current_balance FROM public.wallets WHERE profile_id = auth.uid();
  RETURN coalesce(v_current_balance, 0);
END;
$$;

-- 5. RPCs de Simulação de Saque (Apenas para Testes/Desenvolvimento)
CREATE OR REPLACE FUNCTION public.simulate_approve_withdrawal(
  p_request_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
BEGIN
  -- Buscar o pedido de saque pendente
  SELECT * INTO v_request FROM public.withdrawal_requests
    WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de saque não encontrada ou já processada';
  END IF;

  -- Atualizar status
  UPDATE public.withdrawal_requests
    SET status = 'completed', processed_at = now()
    WHERE id = p_request_id;

  -- Inserir registro na tabela unificada de transações
  INSERT INTO public.transactions (sender_id, receiver_id, amount, platform_fee, type, status, metadata)
  VALUES (
    v_request.profile_id,
    NULL,
    v_request.amount,
    0.00,
    'withdrawal'::public.transaction_type,
    'completed'::public.transaction_status,
    jsonb_build_object('pix_key', v_request.pix_key)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.simulate_reject_withdrawal(
  p_request_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
BEGIN
  -- Buscar o pedido de saque pendente
  SELECT * INTO v_request FROM public.withdrawal_requests
    WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de saque não encontrada ou já processada';
  END IF;

  -- Atualizar status
  UPDATE public.withdrawal_requests
    SET status = 'rejected', rejection_reason = nullif(trim(p_reason), ''), processed_at = now()
    WHERE id = p_request_id;

  -- Devolver o valor na carteira do artista
  UPDATE public.wallets
    SET balance = balance + v_request.amount
    WHERE profile_id = v_request.profile_id;
END;
$$;

-- Garantir acesso a usuários autenticados para chamar os RPCs principais
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_approve_withdrawal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_reject_withdrawal(uuid, text) TO authenticated;

-- Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload schema';
