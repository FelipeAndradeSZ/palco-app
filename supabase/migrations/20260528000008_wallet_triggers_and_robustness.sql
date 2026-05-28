-- 1. Garante que todas as contas existentes têm uma carteira
INSERT INTO public.wallets (profile_id, balance)
SELECT id, 0.00 FROM public.profiles
ON CONFLICT (profile_id) DO NOTHING;

-- 2. Trigger para criar carteira ao inserir novo perfil
CREATE OR REPLACE FUNCTION public.handle_new_profile_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (profile_id, balance)
  VALUES (NEW.id, 0.00)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_handle_new_profile_wallet ON public.profiles;
CREATE TRIGGER tr_handle_new_profile_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_wallet();

-- 3. Atualização robusta do send_artist_tip para assegurar carteira do artista e lançamento no extrato
CREATE OR REPLACE FUNCTION public.send_artist_tip(
  target_room_id uuid,
  target_artist_id uuid,
  tip_amount numeric,
  tip_message text DEFAULT NULL
)
RETURNS public.artist_interactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  created_interaction public.artist_interactions;
  rows_affected int;
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if target_artist_id is null then
    raise exception 'Escolha um artista para enviar a gorjeta';
  end if;

  if tip_amount < 5 or tip_amount > 500 then
    raise exception 'Valor de gorjeta inválido';
  end if;

  -- Garantir carteira ativa do artista antes de começar
  INSERT INTO public.wallets (profile_id, balance)
  VALUES (target_artist_id, 0.00)
  ON CONFLICT (profile_id) DO NOTHING;

  -- Debitar do ouvinte
  update public.wallets
    set balance = balance - tip_amount
    where profile_id = auth.uid()
      and balance >= tip_amount;

  if not found then
    raise exception 'Saldo insuficiente';
  end if;

  -- Creditar 90% para o artista
  update public.wallets
    set balance = balance + (tip_amount * 0.90)
    where profile_id = target_artist_id;

  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    -- Reverter o débito se o crédito não funcionou
    update public.wallets
      set balance = balance + tip_amount
      where profile_id = auth.uid();
    raise exception 'Erro ao creditar o artista. Gorjeta cancelada.';
  end if;

  -- Criar transação unificada
  INSERT INTO public.transactions (sender_id, receiver_id, amount, platform_fee, type, status, metadata)
  VALUES (
    auth.uid(),
    target_artist_id,
    tip_amount,
    tip_amount * 0.10,
    'tip'::public.transaction_type,
    'completed'::public.transaction_status,
    jsonb_build_object('message', nullif(trim(tip_message), ''))
  )
  RETURNING id INTO v_transaction_id;

  insert into public.artist_interactions (
    room_id,
    artist_id,
    sender_id,
    interaction_type,
    amount,
    message,
    metadata
  ) values (
    target_room_id,
    target_artist_id,
    auth.uid(),
    'tip',
    tip_amount,
    nullif(trim(tip_message), ''),
    jsonb_build_object('artist_share', tip_amount * 0.90, 'platform_fee', tip_amount * 0.10, 'transaction_id', v_transaction_id)
  )
  returning * into created_interaction;

  return created_interaction;
end;
$$;

-- 4. Atualização robusta de process_song_request para assegurar carteira do artista antes do crédito
CREATE OR REPLACE FUNCTION public.process_song_request(
  p_request_id uuid,
  p_artist_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request song_requests%ROWTYPE;
  v_artist_amount DECIMAL(10,2);
  v_platform_fee DECIMAL(10,2);
  v_transaction_id UUID;
BEGIN
  -- Buscar o pedido
  SELECT * INTO v_request FROM song_requests WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido nao encontrado ou ja aceito';
  END IF;

  -- Calcular divisao 90/10
  v_platform_fee := ROUND(v_request.bounty_value * 0.10, 2);
  v_artist_amount := v_request.bounty_value - v_platform_fee;

  -- Garantir carteira ativa do artista antes de começar
  INSERT INTO public.wallets (profile_id, balance)
  VALUES (p_artist_id, 0.00)
  ON CONFLICT (profile_id) DO NOTHING;

  -- Criar transacao
  INSERT INTO transactions (sender_id, receiver_id, amount, platform_fee, type, status, metadata)
  VALUES (v_request.requester_id, p_artist_id, v_request.bounty_value, v_platform_fee, 'song_request', 'completed', jsonb_build_object('song_title', v_request.song_title))
  RETURNING id INTO v_transaction_id;

  -- Atualizar carteira do artista
  UPDATE wallets SET balance = balance + v_artist_amount WHERE profile_id = p_artist_id;

  -- Atualizar o pedido
  UPDATE song_requests
  SET status = 'accepted', accepted_by = p_artist_id, transaction_id = v_transaction_id, accepted_at = now()
  WHERE id = p_request_id;
END;
$$;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
