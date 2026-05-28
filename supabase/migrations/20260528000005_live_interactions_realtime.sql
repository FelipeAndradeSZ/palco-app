-- Fix live interactions used by the PALCO MVP.
-- Keeps older databases compatible and enables Supabase Realtime for room activity.

alter table if exists public.song_requests
  add column if not exists dedication text,
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

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'chat_messages',
    'song_requests',
    'rooms',
    'room_artists',
    'artist_interactions'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I replica identity full', table_name);

      begin
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      exception
        when duplicate_object then
          null;
        when undefined_object then
          null;
      end;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
