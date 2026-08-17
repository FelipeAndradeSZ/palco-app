-- Persist only short-lived WebRTC negotiation messages. Audio and video remain
-- peer-to-peer; RLS makes the sender role and recipient authoritative.

create table if not exists public.webrtc_signals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('artist', 'listener')),
  event text not null check (event in (
    'listener-offer',
    'listener-leave',
    'artist-ready',
    'artist-leave',
    'artist-answer',
    'stream-unavailable',
    'ice-candidate'
  )),
  listener_id uuid,
  offer_id uuid,
  sender_session_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint webrtc_signal_payload_size check (octet_length(payload::text) <= 300000),
  constraint webrtc_signal_routing check (
    (
      sender_role = 'listener'
      and event in ('listener-offer', 'listener-leave', 'ice-candidate')
      and recipient_id = artist_id
      and sender_id <> artist_id
      and listener_id is not null
      and (event = 'listener-leave' or offer_id is not null)
    )
    or
    (
      sender_role = 'artist'
      and event in ('artist-ready', 'artist-leave')
      and sender_id = artist_id
      and recipient_id is null
      and listener_id is null
      and offer_id is null
    )
    or
    (
      sender_role = 'artist'
      and event in ('artist-answer', 'stream-unavailable', 'ice-candidate')
      and sender_id = artist_id
      and recipient_id is not null
      and recipient_id <> artist_id
      and listener_id is not null
      and offer_id is not null
    )
  )
);

create index if not exists webrtc_signals_artist_created_idx
  on public.webrtc_signals (artist_id, created_at desc);
create index if not exists webrtc_signals_created_idx
  on public.webrtc_signals (created_at);

alter table public.webrtc_signals enable row level security;

drop policy if exists "Room members read addressed WebRTC signals" on public.webrtc_signals;
create policy "Room members read addressed WebRTC signals"
  on public.webrtc_signals
  for select
  to authenticated
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or (
      sender_role = 'artist'
      and recipient_id is null
      and public.can_access_room_activity(room_id)
    )
  );

drop policy if exists "Room members create valid WebRTC signals" on public.webrtc_signals;
create policy "Room members create valid WebRTC signals"
  on public.webrtc_signals
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_artist_stream_fresh(room_id, artist_id)
    and (
      (
        sender_role = 'artist'
        and auth.uid() = artist_id
      )
      or
      (
        sender_role = 'listener'
        and auth.uid() <> artist_id
        and public.can_access_room_activity(room_id)
      )
    )
  );

revoke all on table public.webrtc_signals from public, anon;
grant select, insert on table public.webrtc_signals to authenticated;

create or replace function public.cleanup_stale_webrtc_signals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.webrtc_signals
  where created_at < now() - interval '10 minutes';
  return new;
end;
$$;

revoke all on function public.cleanup_stale_webrtc_signals() from public, anon, authenticated;

drop trigger if exists cleanup_stale_webrtc_signals_trigger on public.webrtc_signals;
create trigger cleanup_stale_webrtc_signals_trigger
  before insert on public.webrtc_signals
  for each statement
  execute function public.cleanup_stale_webrtc_signals();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'webrtc_signals'
  ) then
    alter publication supabase_realtime add table public.webrtc_signals;
  end if;
end;
$$;

-- Media Broadcast topics are retired. Keep only the room interaction topic in
-- Realtime Broadcast policies so older clients cannot bypass signal routing.
create or replace function public.can_receive_realtime_room_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parts text[];
  v_room_id uuid;
begin
  if auth.uid() is null or p_topic is null then
    return false;
  end if;

  if p_topic ~ '^room-bc:[0-9a-fA-F-]{36}$' then
    v_parts := string_to_array(p_topic, ':');
    v_room_id := v_parts[2]::uuid;
    return public.can_access_room_activity(v_room_id);
  end if;

  return false;
exception
  when invalid_text_representation then
    return false;
end;
$$;

create or replace function public.can_send_realtime_room_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parts text[];
  v_room_id uuid;
begin
  if auth.uid() is null or p_topic is null then
    return false;
  end if;

  if p_topic ~ '^room-bc:[0-9a-fA-F-]{36}$' then
    v_parts := string_to_array(p_topic, ':');
    v_room_id := v_parts[2]::uuid;
    return public.can_access_room_activity(v_room_id);
  end if;

  return false;
exception
  when invalid_text_representation then
    return false;
end;
$$;

notify pgrst, 'reload schema';
