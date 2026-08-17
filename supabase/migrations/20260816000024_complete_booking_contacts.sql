-- A booking must lead to a real conversation. Contact details stay private in
-- booking rows, which are readable only by the venue, artist and platform admin.

alter table public.venue_profiles
  add column if not exists preferred_genre text,
  add column if not exists vibe_level text not null default 'animado',
  add column if not exists interaction_level text not null default 'medium',
  add column if not exists preferred_region text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists audience_participation boolean not null default true,
  add column if not exists auto_switch_artists boolean not null default true,
  add column if not exists contact_phone text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.booking_requests
  add column if not exists venue_contact_phone text,
  add column if not exists artist_contact_phone text;

alter table public.venue_profiles
  drop constraint if exists venue_profiles_vibe_level_check,
  add constraint venue_profiles_vibe_level_check
    check (vibe_level in ('calmo', 'animado', 'interativo')),
  drop constraint if exists venue_profiles_interaction_level_check,
  add constraint venue_profiles_interaction_level_check
    check (interaction_level in ('low', 'medium', 'high')),
  drop constraint if exists venue_profiles_preferred_region_check,
  add constraint venue_profiles_preferred_region_check
    check (preferred_region is null or preferred_region in ('norte', 'nordeste', 'centro-oeste', 'sudeste', 'sul')),
  drop constraint if exists venue_profiles_contact_phone_check,
  add constraint venue_profiles_contact_phone_check
    check (
      contact_phone is null
      or (
        char_length(contact_phone) between 8 and 30
        and contact_phone ~ '^[0-9+() .-]+$'
        and char_length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) between 8 and 15
      )
    ),
  drop constraint if exists venue_profiles_city_length_check,
  add constraint venue_profiles_city_length_check
    check (city is null or char_length(city) <= 120),
  drop constraint if exists venue_profiles_state_check,
  add constraint venue_profiles_state_check
    check (state is null or state ~ '^[A-Z]{2}$');

alter table public.booking_requests
  drop constraint if exists booking_requests_venue_contact_check,
  add constraint booking_requests_venue_contact_check
    check (
      venue_contact_phone is null
      or (
        char_length(venue_contact_phone) between 8 and 30
        and venue_contact_phone ~ '^[0-9+() .-]+$'
        and char_length(regexp_replace(venue_contact_phone, '[^0-9]', '', 'g')) between 8 and 15
      )
    ),
  drop constraint if exists booking_requests_artist_contact_check,
  add constraint booking_requests_artist_contact_check
    check (
      artist_contact_phone is null
      or (
        char_length(artist_contact_phone) between 8 and 40
        and artist_contact_phone ~ '^[0-9+() .-]+$'
        and char_length(regexp_replace(artist_contact_phone, '[^0-9]', '', 'g')) between 8 and 15
      )
    );

alter table public.artist_details disable trigger tr_guard_artist_details_quality;

update public.artist_details
set available_for_booking = false
where available_for_booking = true
  and (
    nullif(trim(booking_whatsapp), '') is null
    or booking_whatsapp !~ '^[0-9+() .-]+$'
    or char_length(regexp_replace(booking_whatsapp, '[^0-9]', '', 'g')) not between 8 and 15
  );

alter table public.artist_details enable trigger tr_guard_artist_details_quality;

create or replace function public.guard_artist_booking_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.booking_whatsapp := nullif(trim(new.booking_whatsapp), '');

  if tg_op = 'INSERT' and new.booking_whatsapp is null then
    new.available_for_booking := false;
    return new;
  end if;

  if new.available_for_booking = true and (
    new.booking_whatsapp is null
    or new.booking_whatsapp !~ '^[0-9+() .-]+$'
    or char_length(new.booking_whatsapp) > 40
    or char_length(regexp_replace(new.booking_whatsapp, '[^0-9]', '', 'g')) not between 8 and 15
  ) then
    raise exception 'Cadastre um WhatsApp profissional valido para receber contratacoes';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_artist_booking_contact on public.artist_details;
create trigger trg_guard_artist_booking_contact
before insert or update on public.artist_details
for each row execute function public.guard_artist_booking_contact();

revoke all on function public.guard_artist_booking_contact() from public, anon, authenticated;

create or replace function public.guard_booking_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist_contact text;
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
    new.venue_contact_phone := nullif(trim(new.venue_contact_phone), '');
    new.artist_contact_phone := null;

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

    if new.venue_contact_phone is null
       or char_length(new.venue_contact_phone) < 8
       or char_length(new.venue_contact_phone) > 30
       or new.venue_contact_phone !~ '^[0-9+() .-]+$'
       or char_length(regexp_replace(new.venue_contact_phone, '[^0-9]', '', 'g')) not between 8 and 15 then
      raise exception 'Informe um telefone ou WhatsApp valido para retorno';
    end if;

    if exists (
      select 1 from public.booking_requests
      where venue_id = auth.uid()
        and artist_id = new.artist_id
        and status = 'pending'
    ) then
      raise exception 'Ja existe uma solicitacao pendente para este artista';
    end if;

    update public.venue_profiles
       set contact_phone = new.venue_contact_phone
     where profile_id = auth.uid();

    return new;
  end if;

  if new.venue_id is distinct from old.venue_id
     or new.artist_id is distinct from old.artist_id
     or new.event_date is distinct from old.event_date
     or new.city is distinct from old.city
     or new.state is distinct from old.state
     or new.message is distinct from old.message
     or new.budget is distinct from old.budget
     or new.venue_contact_phone is distinct from old.venue_contact_phone
     or new.created_at is distinct from old.created_at then
    raise exception 'Dados originais da solicitacao nao podem ser alterados';
  end if;

  if auth.uid() = old.artist_id
     and old.status = 'pending'
     and new.status in ('accepted', 'declined') then
    if new.status = 'accepted' then
      select nullif(trim(booking_whatsapp), '') into v_artist_contact
      from public.artist_details
      where profile_id = old.artist_id;

      if v_artist_contact is null then
        raise exception 'Cadastre seu WhatsApp profissional no perfil antes de aceitar';
      end if;
      new.artist_contact_phone := v_artist_contact;
    else
      new.artist_contact_phone := null;
    end if;
    return new;
  end if;

  if auth.uid() = old.venue_id
     and old.status in ('pending', 'accepted')
     and new.status = 'cancelled' then
    new.artist_contact_phone := old.artist_contact_phone;
    return new;
  end if;

  if public.is_platform_admin()
     and new.status in ('accepted', 'declined', 'cancelled') then
    if new.status = 'accepted' then
      select nullif(trim(booking_whatsapp), '') into v_artist_contact
      from public.artist_details
      where profile_id = old.artist_id;
      new.artist_contact_phone := v_artist_contact;
    elsif new.status = 'declined' then
      new.artist_contact_phone := null;
    else
      new.artist_contact_phone := old.artist_contact_phone;
    end if;
    return new;
  end if;

  raise exception 'Transicao de status da contratacao nao permitida';
end;
$$;

revoke all on function public.guard_booking_request() from public, anon, authenticated;

notify pgrst, 'reload schema';
