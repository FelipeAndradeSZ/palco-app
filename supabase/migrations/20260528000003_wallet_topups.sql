create table if not exists public.wallet_topups (
  session_id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  provider text not null default 'stripe',
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

alter table public.wallet_topups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wallet_topups'
      and policyname = 'Users can read own wallet topups'
  ) then
    create policy "Users can read own wallet topups"
      on public.wallet_topups for select
      using (auth.uid() = profile_id);
  end if;
end $$;

create or replace function public.credit_wallet_topup(
  checkout_session_id text,
  target_profile_id uuid,
  credit_amount numeric
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance numeric;
begin
  if checkout_session_id is null or length(trim(checkout_session_id)) = 0 then
    raise exception 'Sessao de checkout invalida';
  end if;

  if target_profile_id is null then
    raise exception 'Perfil invalido';
  end if;

  if credit_amount < 5 or credit_amount > 5000 then
    raise exception 'Valor de recarga invalido';
  end if;

  if exists (
    select 1 from public.wallet_topups
    where session_id = checkout_session_id
  ) then
    select balance into current_balance
      from public.wallets
      where profile_id = target_profile_id;

    return coalesce(current_balance, 0);
  end if;

  insert into public.wallet_topups (session_id, profile_id, amount)
  values (checkout_session_id, target_profile_id, credit_amount);

  update public.wallets
    set balance = coalesce(balance, 0) + credit_amount
    where profile_id = target_profile_id
    returning balance into current_balance;

  if not found then
    insert into public.wallets (profile_id, balance)
    values (target_profile_id, credit_amount)
    returning balance into current_balance;
  end if;

  return coalesce(current_balance, credit_amount);
end;
$$;

grant execute on function public.credit_wallet_topup(text, uuid, numeric) to service_role;
grant execute on function public.credit_wallet_topup(text, uuid, numeric) to authenticated;
