-- Admin helpers and payout security hardening.

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  label text,
  is_master boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.admin_users (email, label, is_master)
values ('felipedosreis2002@gmail.com', 'Admin master PALCO', true)
on conflict (email) do update
  set is_master = true,
      label = excluded.label;

alter table public.admin_users enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or coalesce(lower(auth.jwt() -> 'app_metadata' ->> 'is_admin') in ('true', '1', 'yes'), false)
    or exists (
      select 1
      from public.admin_users au
      where lower(au.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
  on public.admin_users for select
  using (public.is_platform_admin());

create or replace function public.simulate_approve_withdrawal(
  p_request_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas administradores podem aprovar saques';
  end if;

  select * into v_request
  from public.withdrawal_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Solicitacao de saque nao encontrada ou ja processada';
  end if;

  update public.withdrawal_requests
    set status = 'completed', processed_at = now()
    where id = p_request_id;

  insert into public.transactions (sender_id, receiver_id, amount, platform_fee, type, status, metadata)
  values (
    v_request.profile_id,
    null,
    v_request.amount,
    0.00,
    'withdrawal'::public.transaction_type,
    'completed'::public.transaction_status,
    jsonb_build_object('pix_key', v_request.pix_key, 'processed_by', auth.uid())
  );
end;
$$;

create or replace function public.simulate_reject_withdrawal(
  p_request_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas administradores podem recusar saques';
  end if;

  select * into v_request
  from public.withdrawal_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Solicitacao de saque nao encontrada ou ja processada';
  end if;

  update public.withdrawal_requests
    set status = 'rejected',
        rejection_reason = nullif(trim(p_reason), ''),
        processed_at = now()
    where id = p_request_id;

  update public.wallets
    set balance = balance + v_request.amount
    where profile_id = v_request.profile_id;
end;
$$;

create or replace function public.curator_update_artist_tier(
  p_profile_id uuid,
  p_quality_tier text
) returns public.artist_details
language plpgsql
security definer
set search_path = public
as $$
declare
  v_details public.artist_details;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas curadores podem alterar categoria de artistas';
  end if;

  if p_quality_tier not in ('bronze', 'prata', 'ouro', 'premium', 'verified') then
    raise exception 'Categoria invalida';
  end if;

  insert into public.artist_details (profile_id, quality_tier)
  values (p_profile_id, p_quality_tier)
  on conflict (profile_id)
  do update set quality_tier = excluded.quality_tier
  returning * into v_details;

  return v_details;
end;
$$;

drop policy if exists "Admins can read all withdrawals" on public.withdrawal_requests;
create policy "Admins can read all withdrawals"
  on public.withdrawal_requests for select
  using (public.is_platform_admin());

drop policy if exists "Admins can update all withdrawals" on public.withdrawal_requests;
create policy "Admins can update all withdrawals"
  on public.withdrawal_requests for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.simulate_approve_withdrawal(uuid) to authenticated;
grant execute on function public.simulate_reject_withdrawal(uuid, text) to authenticated;
grant execute on function public.curator_update_artist_tier(uuid, text) to authenticated;

notify pgrst, 'reload schema';
