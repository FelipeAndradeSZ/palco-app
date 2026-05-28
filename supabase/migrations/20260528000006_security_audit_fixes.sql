-- =============================================
-- Migração de Segurança — 2026-05-28
-- Corrige vulnerabilidades críticas encontradas
-- na auditoria de segurança do PALCO.
-- =============================================

-- 1. CRÍTICO: Remove o RPC add_funds que permitia
--    qualquer usuário autenticado adicionar saldo infinito
--    sem pagar nada.
DROP FUNCTION IF EXISTS public.add_funds(numeric);

-- 2. CRÍTICO: Revoga acesso do role 'authenticated' ao
--    credit_wallet_topup. Somente service_role (Edge Functions)
--    pode executar. Isso impede um atacante de fabricar
--    um session_id falso e creditar saldo via console.
REVOKE EXECUTE ON FUNCTION public.credit_wallet_topup(text, numeric, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_wallet_topup(text, numeric, uuid) FROM anon;

-- 3. HIGH: Protege send_artist_tip contra perda de dinheiro
--    quando o artista alvo não tem carteira (o dinheiro sumia).
--    Agora verifica existência da carteira do artista ANTES de
--    debitar, e reverte se o crédito falhar.
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

  -- Verificar que o artista alvo existe e tem carteira
  if not exists (select 1 from public.wallets where profile_id = target_artist_id) then
    raise exception 'Artista não encontrado ou sem carteira ativa';
  end if;

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
    jsonb_build_object('artist_share', tip_amount * 0.90, 'platform_fee', tip_amount * 0.10)
  )
  returning * into created_interaction;

  return created_interaction;
end;
$$;

-- 4. MEDIUM: Trigger para impedir escalação de role após onboarding
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Não permite reverter onboarding_completed de true para false
  IF OLD.onboarding_completed = true AND NEW.onboarding_completed = false THEN
    NEW.onboarding_completed := true;
  END IF;

  -- Não permite mudar role depois que o onboarding está completo
  IF OLD.onboarding_completed = true AND NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_guard_profile_update ON public.profiles;
CREATE TRIGGER tr_guard_profile_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';
