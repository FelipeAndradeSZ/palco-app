-- Make Stripe top-ups safe when the browser confirmation and webhook arrive
-- at the same time. The checkout session remains the idempotency key.

create or replace function public.credit_wallet_topup(
  checkout_session_id text,
  credit_amount numeric,
  target_profile_id uuid
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created boolean;
  v_existing_profile_id uuid;
  v_existing_amount numeric(10,2);
  v_balance numeric(10,2);
begin
  if checkout_session_id is null or length(trim(checkout_session_id)) = 0 then
    raise exception 'Sessao de checkout invalida';
  end if;

  if target_profile_id is null then
    raise exception 'Perfil invalido';
  end if;

  if credit_amount is null
     or credit_amount < 5
     or credit_amount > 5000
     or credit_amount <> round(credit_amount, 2) then
    raise exception 'Valor de recarga invalido';
  end if;

  if not exists (select 1 from public.profiles where id = target_profile_id) then
    raise exception 'Perfil nao encontrado';
  end if;

  insert into public.wallet_topups (session_id, profile_id, amount)
  values (trim(checkout_session_id), target_profile_id, credit_amount)
  on conflict (session_id) do nothing
  returning true into v_created;

  if not coalesce(v_created, false) then
    select profile_id, amount
      into v_existing_profile_id, v_existing_amount
    from public.wallet_topups
    where session_id = trim(checkout_session_id);

    if v_existing_profile_id is distinct from target_profile_id
       or v_existing_amount is distinct from credit_amount then
      raise exception 'Sessao de checkout ja confirmada com dados diferentes';
    end if;

    select balance into v_balance
    from public.wallets
    where profile_id = v_existing_profile_id;

    return coalesce(v_balance, 0);
  end if;

  insert into public.wallets (profile_id, balance)
  values (target_profile_id, credit_amount)
  on conflict (profile_id) do update
    set balance = public.wallets.balance + excluded.balance
  returning balance into v_balance;

  return v_balance;
end;
$$;

revoke all on function public.credit_wallet_topup(text, numeric, uuid) from public, anon, authenticated;
grant execute on function public.credit_wallet_topup(text, numeric, uuid) to service_role;

notify pgrst, 'reload schema';
