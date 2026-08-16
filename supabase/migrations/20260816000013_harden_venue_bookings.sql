-- Restrict venue configuration ownership and make booking state changes explicit.

create or replace function public.guard_venue_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.profile_id is distinct from old.profile_id then
    raise exception 'O proprietario do estabelecimento nao pode ser alterado';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = new.profile_id
      and role = 'venue'
  ) then
    raise exception 'A configuracao de ambiente exige uma conta de estabelecimento';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_venue_profile_role on public.venue_profiles;
create trigger trg_guard_venue_profile_role
before insert or update on public.venue_profiles
for each row execute function public.guard_venue_profile_role();

create or replace function public.guard_booking_request_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.venue_id = new.artist_id then
      raise exception 'Estabelecimento e artista devem ser contas diferentes';
    end if;

    if not exists (
      select 1 from public.profiles
      where id = new.venue_id and role = 'venue'
    ) then
      raise exception 'Conta de estabelecimento invalida';
    end if;

    if not exists (
      select 1
      from public.profiles p
      join public.artist_details ad on ad.profile_id = p.id
      where p.id = new.artist_id
        and p.role = 'artist'
        and ad.available_for_booking = true
    ) then
      raise exception 'Artista indisponivel para contratacao';
    end if;
  elsif row(
    new.venue_id,
    new.artist_id,
    new.event_date,
    new.city,
    new.state,
    new.message,
    new.budget,
    new.created_at
  ) is distinct from row(
    old.venue_id,
    old.artist_id,
    old.event_date,
    old.city,
    old.state,
    old.message,
    old.budget,
    old.created_at
  ) then
    raise exception 'Os dados da solicitacao nao podem ser alterados depois do envio';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_booking_request_fields on public.booking_requests;
create trigger trg_guard_booking_request_fields
before insert or update on public.booking_requests
for each row execute function public.guard_booking_request_fields();

alter table public.booking_requests
  drop constraint if exists booking_requests_budget_positive,
  add constraint booking_requests_budget_positive
    check (budget is null or budget > 0),
  drop constraint if exists booking_requests_message_length,
  add constraint booking_requests_message_length
    check (message is null or char_length(message) <= 1000);

drop policy if exists "Booking participants can update status" on public.booking_requests;
revoke update, delete on public.booking_requests from anon, authenticated;

create or replace function public.update_booking_status(
  p_request_id uuid,
  p_status text
) returns public.booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.booking_requests;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  select * into v_request
  from public.booking_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitacao de contratacao nao encontrada';
  end if;

  if auth.uid() = v_request.artist_id then
    if v_request.status <> 'pending' or p_status not in ('accepted', 'declined') then
      raise exception 'O artista so pode aceitar ou recusar uma solicitacao pendente';
    end if;
  elsif auth.uid() = v_request.venue_id then
    if v_request.status not in ('pending', 'accepted') or p_status <> 'cancelled' then
      raise exception 'O estabelecimento so pode cancelar uma solicitacao ativa';
    end if;
  elsif not public.is_platform_admin() then
    raise exception 'Usuario sem permissao para atualizar esta solicitacao';
  end if;

  update public.booking_requests
     set status = p_status
   where id = p_request_id
   returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.guard_venue_profile_role() from public, anon, authenticated;
revoke all on function public.guard_booking_request_fields() from public, anon, authenticated;
revoke all on function public.update_booking_status(uuid, text) from public, anon;
grant execute on function public.update_booking_status(uuid, text) to authenticated;

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

  update public.artist_details ad
     set quality_tier = p_quality_tier::public.quality_tier
   where ad.profile_id = p_profile_id
     and exists (
       select 1 from public.profiles p
       where p.id = p_profile_id and p.role = 'artist'
     )
   returning * into v_details;

  if not found then
    raise exception 'Perfil de artista nao encontrado';
  end if;

  return v_details;
end;
$$;

revoke all on function public.curator_update_artist_tier(uuid, text) from public, anon;
grant execute on function public.curator_update_artist_tier(uuid, text) to authenticated;

notify pgrst, 'reload schema';
