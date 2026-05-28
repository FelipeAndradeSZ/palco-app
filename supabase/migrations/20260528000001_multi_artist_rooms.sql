-- PALCO multi-artist room model.
-- A room is the genre/environment. Multiple artists can be live inside it.

create table if not exists public.room_artists (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null constraint room_artists_room_id_fkey references public.rooms(id) on delete cascade,
  artist_id uuid not null constraint room_artists_artist_id_fkey references public.profiles(id) on delete cascade,
  status text not null default 'live' check (status in ('live', 'paused', 'offline')),
  is_featured boolean not null default false,
  performance_order integer not null default 0,
  current_song text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_artists_room_artist_unique unique (room_id, artist_id)
);

create index if not exists room_artists_room_status_idx
  on public.room_artists (room_id, status, is_featured desc, performance_order asc);

create index if not exists room_artists_artist_status_idx
  on public.room_artists (artist_id, status);

alter table public.room_artists enable row level security;

drop policy if exists "room_artists_select_all" on public.room_artists;
create policy "room_artists_select_all"
  on public.room_artists
  for select
  using (true);

drop policy if exists "room_artists_artist_insert_self" on public.room_artists;
create policy "room_artists_artist_insert_self"
  on public.room_artists
  for insert
  with check (
    artist_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'artist'
    )
  );

drop policy if exists "room_artists_artist_update_self" on public.room_artists;
create policy "room_artists_artist_update_self"
  on public.room_artists
  for update
  using (artist_id = auth.uid())
  with check (artist_id = auth.uid());

alter table if exists public.song_requests
  add column if not exists target_artist_id uuid
    constraint song_requests_target_artist_id_fkey references public.profiles(id) on delete set null,
  add column if not exists request_source text not null default 'app'
    check (request_source in ('app', 'qr', 'venue', 'system')),
  add column if not exists guest_name text;

do $$
begin
  if to_regclass('public.song_requests') is not null then
    create index if not exists song_requests_room_target_status_idx
      on public.song_requests (room_id, target_artist_id, status, created_at);
  end if;
end $$;

alter table if exists public.artist_details
  add column if not exists bio text,
  add column if not exists repertoire text,
  add column if not exists pix_key text,
  add column if not exists instagram_url text,
  add column if not exists booking_whatsapp text;
