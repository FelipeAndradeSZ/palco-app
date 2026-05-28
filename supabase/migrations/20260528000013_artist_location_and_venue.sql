-- Artist location, venue ambiente preferences and booking requests.

alter table if exists public.artist_details
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists region text
    check (region is null or region in ('norte', 'nordeste', 'centro-oeste', 'sudeste', 'sul')),
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists available_for_booking boolean not null default true;

create index if not exists artist_details_location_idx
  on public.artist_details (region, state, city);

create table if not exists public.venue_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  preferred_genre text,
  vibe_level text not null default 'animado' check (vibe_level in ('calmo', 'animado', 'interativo')),
  interaction_level text not null default 'medium' check (interaction_level in ('low', 'medium', 'high')),
  preferred_region text check (preferred_region is null or preferred_region in ('norte', 'nordeste', 'centro-oeste', 'sudeste', 'sul')),
  city text,
  state text,
  audience_participation boolean not null default true,
  auto_switch_artists boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  event_date timestamptz,
  city text,
  state text,
  message text,
  budget numeric(10,2),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venue_profiles_preferences_idx
  on public.venue_profiles (preferred_region, preferred_genre, vibe_level);

create index if not exists booking_requests_venue_idx
  on public.booking_requests (venue_id, created_at desc);

create index if not exists booking_requests_artist_idx
  on public.booking_requests (artist_id, status, created_at desc);

alter table public.venue_profiles enable row level security;
alter table public.booking_requests enable row level security;

drop policy if exists "Venue profile owner can read" on public.venue_profiles;
create policy "Venue profile owner can read"
  on public.venue_profiles for select
  using (auth.uid() = profile_id);

drop policy if exists "Venue profile owner can insert" on public.venue_profiles;
create policy "Venue profile owner can insert"
  on public.venue_profiles for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Venue profile owner can update" on public.venue_profiles;
create policy "Venue profile owner can update"
  on public.venue_profiles for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "Booking participants can read" on public.booking_requests;
create policy "Booking participants can read"
  on public.booking_requests for select
  using (auth.uid() in (venue_id, artist_id));

drop policy if exists "Venues can create booking requests" on public.booking_requests;
create policy "Venues can create booking requests"
  on public.booking_requests for insert
  with check (
    auth.uid() = venue_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'venue'
    )
  );

drop policy if exists "Booking participants can update status" on public.booking_requests;
create policy "Booking participants can update status"
  on public.booking_requests for update
  using (auth.uid() in (venue_id, artist_id))
  with check (auth.uid() in (venue_id, artist_id));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_venue_profiles_touch_updated_at on public.venue_profiles;
create trigger tr_venue_profiles_touch_updated_at
  before update on public.venue_profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists tr_booking_requests_touch_updated_at on public.booking_requests;
create trigger tr_booking_requests_touch_updated_at
  before update on public.booking_requests
  for each row execute function public.touch_updated_at();

notify pgrst, 'reload schema';
