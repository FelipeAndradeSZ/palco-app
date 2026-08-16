-- A booking request must contain enough information for an artist to make a
-- real decision. Existing legacy rows remain readable and can still be closed.

alter table public.booking_requests
  drop constraint if exists booking_requests_city_length_check,
  add constraint booking_requests_city_length_check
    check (city is null or char_length(city) <= 120),
  drop constraint if exists booking_requests_state_format_check,
  add constraint booking_requests_state_format_check
    check (state is null or state ~ '^[A-Z]{2}$'),
  drop constraint if exists booking_requests_budget_limit_check,
  add constraint booking_requests_budget_limit_check
    check (budget is null or (budget > 0 and budget <= 1000000));

create or replace function public.guard_booking_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if tg_op = 'INSERT' then
    new.venue_id := auth.uid();
    new.status := 'pending';
    new.city := nullif(trim(new.city), '');
    new.state := nullif(upper(trim(new.state)), '');
    new.message := nullif(trim(new.message), '');

    if not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'venue'
    ) then
      raise exception 'Apenas estabelecimentos podem solicitar contratacao';
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

    if new.event_date is null or new.event_date <= now() + interval '1 hour' then
      raise exception 'Informe uma data futura para o evento';
    end if;

    if new.city is null or char_length(new.city) > 120 then
      raise exception 'Informe a cidade do evento';
    end if;

    if new.state is null or new.state !~ '^[A-Z]{2}$' then
      raise exception 'Informe o estado com duas letras';
    end if;

    if new.budget is null or new.budget <= 0 or new.budget > 1000000 then
      raise exception 'Informe um orcamento valido';
    end if;

    if char_length(coalesce(new.message, '')) > 1000 then
      raise exception 'Mensagem de contratacao muito longa';
    end if;

    if exists (
      select 1 from public.booking_requests
      where venue_id = auth.uid()
        and artist_id = new.artist_id
        and status = 'pending'
    ) then
      raise exception 'Ja existe uma solicitacao pendente para este artista';
    end if;

    return new;
  end if;

  if new.venue_id is distinct from old.venue_id
     or new.artist_id is distinct from old.artist_id
     or new.event_date is distinct from old.event_date
     or new.city is distinct from old.city
     or new.state is distinct from old.state
     or new.message is distinct from old.message
     or new.budget is distinct from old.budget
     or new.created_at is distinct from old.created_at then
    raise exception 'Dados originais da solicitacao nao podem ser alterados';
  end if;

  if auth.uid() = old.artist_id
     and old.status = 'pending'
     and new.status in ('accepted', 'declined') then
    return new;
  end if;

  if auth.uid() = old.venue_id
     and old.status in ('pending', 'accepted')
     and new.status = 'cancelled' then
    return new;
  end if;

  raise exception 'Transicao de status da contratacao nao permitida';
end;
$$;

revoke all on function public.guard_booking_request() from public, anon, authenticated;

notify pgrst, 'reload schema';
