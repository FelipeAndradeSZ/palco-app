-- Database-level guards for requests that may arrive concurrently.

create unique index if not exists withdrawal_requests_one_pending_per_profile_idx
  on public.withdrawal_requests (profile_id)
  where status = 'pending';

create unique index if not exists battles_one_active_pair_per_room_idx
  on public.battles (
    room_id,
    least(challenger_artist_id, opponent_artist_id),
    greatest(challenger_artist_id, opponent_artist_id)
  )
  where status in ('pending', 'active', 'voting');

create or replace function public.request_withdrawal(
  p_amount numeric,
  p_pix_key text
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance numeric;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'artist'
  ) then
    raise exception 'Apenas artistas podem solicitar saque';
  end if;

  if p_amount is null
     or p_amount < 10
     or p_amount > 5000
     or p_amount <> round(p_amount, 2) then
    raise exception 'O saque deve ficar entre R$ 10,00 e R$ 5.000,00 com no maximo dois centavos';
  end if;

  if nullif(trim(p_pix_key), '') is null or length(trim(p_pix_key)) > 180 then
    raise exception 'Chave PIX invalida';
  end if;

  if exists (
    select 1 from public.withdrawal_requests
    where profile_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'Voce ja possui um saque pendente';
  end if;

  update public.wallets
    set balance = balance - p_amount
    where profile_id = auth.uid()
      and balance >= p_amount;

  if not found then
    raise exception 'Saldo insuficiente para realizar o saque';
  end if;

  begin
    insert into public.withdrawal_requests (profile_id, amount, pix_key, status)
    values (auth.uid(), p_amount, trim(p_pix_key), 'pending');
  exception
    when unique_violation then
      raise exception 'Voce ja possui um saque pendente';
  end;

  select balance into v_current_balance
  from public.wallets
  where profile_id = auth.uid();

  return coalesce(v_current_balance, 0);
end;
$$;

revoke all on function public.request_withdrawal(numeric, text) from public, anon;
grant execute on function public.request_withdrawal(numeric, text) to authenticated;

notify pgrst, 'reload schema';
