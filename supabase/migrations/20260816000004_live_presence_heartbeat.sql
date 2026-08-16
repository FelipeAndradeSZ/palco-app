-- Expire abandoned browser sessions and never sell interactions to a dead stream.

alter table public.room_artists
  add column if not exists last_heartbeat_at timestamptz not null default now();

alter table public.room_participants
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists room_artists_live_heartbeat_idx
  on public.room_artists (status, last_heartbeat_at)
  where status = 'live';

create index if not exists room_participants_last_seen_idx
  on public.room_participants (last_seen_at);

create or replace function public.is_artist_stream_fresh(p_room_id uuid, p_artist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_artists
    where room_id = p_room_id
      and artist_id = p_artist_id
      and status = 'live'
      and last_heartbeat_at > now() - interval '90 seconds'
  );
$$;

create or replace function public.set_artist_live_state(
  p_room_id uuid,
  p_is_live boolean
) returns public.room_artists
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_artist public.room_artists;
  v_next_artist_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'artist'
  ) then
    raise exception 'Apenas artistas autenticados podem controlar uma transmissao';
  end if;

  if not exists (select 1 from public.rooms where id = p_room_id and is_active = true) then
    raise exception 'Sala indisponivel';
  end if;

  if p_is_live then
    update public.room_artists
      set status = 'offline', ended_at = now(), is_featured = false, updated_at = now()
      where artist_id = auth.uid()
        and room_id <> p_room_id
        and status <> 'offline';

    insert into public.room_artists (
      room_id, artist_id, status, started_at, ended_at, updated_at, last_heartbeat_at
    ) values (
      p_room_id, auth.uid(), 'live', now(), null, now(), now()
    )
    on conflict (room_id, artist_id) do update
      set status = 'live',
          started_at = now(),
          ended_at = null,
          updated_at = now(),
          last_heartbeat_at = now()
    returning * into v_room_artist;

    update public.rooms
      set current_artist_id = auth.uid()
      where id = p_room_id;
  else
    update public.room_artists
      set status = 'offline', ended_at = now(), is_featured = false, updated_at = now()
      where room_id = p_room_id and artist_id = auth.uid()
    returning * into v_room_artist;

    select artist_id into v_next_artist_id
    from public.room_artists
    where room_id = p_room_id
      and status = 'live'
      and last_heartbeat_at > now() - interval '90 seconds'
    order by is_featured desc, performance_order asc, started_at asc
    limit 1;

    update public.rooms
      set current_artist_id = v_next_artist_id
      where id = p_room_id
        and current_artist_id = auth.uid();
  end if;

  return v_room_artist;
end;
$$;

create or replace function public.heartbeat_artist_live(p_room_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_heartbeat timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  update public.room_artists
     set last_heartbeat_at = now()
   where room_id = p_room_id
     and artist_id = auth.uid()
     and status = 'live'
  returning last_heartbeat_at into v_heartbeat;

  if v_heartbeat is null then
    raise exception 'Transmissao nao encontrada';
  end if;

  return v_heartbeat;
end;
$$;

create or replace function public.guard_room_participant_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_role text;
begin
  if auth.uid() is null then
    raise exception 'Autenticacao obrigatoria para entrar na sala';
  end if;

  if new.profile_id is distinct from auth.uid() then
    raise exception 'Participante invalido';
  end if;

  select role::text into v_profile_role
  from public.profiles
  where id = auth.uid();

  if v_profile_role is null or new.role::text is distinct from v_profile_role then
    raise exception 'Papel do participante nao corresponde ao perfil';
  end if;

  new.last_seen_at := now();
  return new;
end;
$$;

create or replace function public.sync_room_listener_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.room_id is not distinct from new.room_id
     and old.role is not distinct from new.role then
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_room_listener_count(old.room_id);
    return old;
  end if;

  perform public.refresh_room_listener_count(new.room_id);

  if tg_op = 'UPDATE' and old.room_id is distinct from new.room_id then
    perform public.refresh_room_listener_count(old.room_id);
  end if;

  return new;
end;
$$;

create or replace function public.expire_stale_room_presence()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_artists integer := 0;
  v_expired_participants integer := 0;
begin
  update public.room_artists
     set status = 'offline',
         ended_at = coalesce(ended_at, now()),
         is_featured = false,
         updated_at = now()
   where status = 'live'
     and last_heartbeat_at <= now() - interval '90 seconds';
  get diagnostics v_expired_artists = row_count;

  delete from public.room_participants
   where last_seen_at <= now() - interval '90 seconds';
  get diagnostics v_expired_participants = row_count;

  update public.rooms r
     set current_artist_id = (
       select ra.artist_id
       from public.room_artists ra
       where ra.room_id = r.id
         and ra.status = 'live'
         and ra.last_heartbeat_at > now() - interval '90 seconds'
       order by ra.is_featured desc, ra.performance_order asc, ra.started_at asc
       limit 1
     )
   where r.current_artist_id is not null
     and not public.is_artist_stream_fresh(r.id, r.current_artist_id);

  return jsonb_build_object(
    'expired_artists', v_expired_artists,
    'expired_participants', v_expired_participants
  );
end;
$$;

create or replace function public.require_fresh_artist_interaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_room_id uuid;
  v_artist_id uuid;
begin
  v_room_id := nullif(v_new ->> 'room_id', '')::uuid;

  if tg_table_name = 'song_requests' then
    if tg_op = 'INSERT' then
      v_artist_id := nullif(v_new ->> 'target_artist_id', '')::uuid;
    elsif v_new ->> 'status' = 'accepted' and v_old ->> 'status' is distinct from 'accepted' then
      v_artist_id := nullif(v_new ->> 'accepted_by', '')::uuid;
    end if;
  elsif tg_table_name in ('artist_interactions', 'artist_votes', 'chat_messages') then
    v_artist_id := nullif(v_new ->> 'artist_id', '')::uuid;
  end if;

  if v_artist_id is not null and not public.is_artist_stream_fresh(v_room_id, v_artist_id) then
    raise exception 'O artista nao esta mais transmitindo nesta sala';
  end if;

  return new;
end;
$$;

create or replace function public.require_fresh_battle_artists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_artist_stream_fresh(new.room_id, new.challenger_artist_id)
     or not public.is_artist_stream_fresh(new.room_id, new.opponent_artist_id) then
    raise exception 'Os dois artistas precisam estar transmitindo para iniciar a batalha';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_fresh_song_request on public.song_requests;
create trigger trg_require_fresh_song_request
before insert or update on public.song_requests
for each row execute function public.require_fresh_artist_interaction();

drop trigger if exists trg_require_fresh_artist_interaction on public.artist_interactions;
create trigger trg_require_fresh_artist_interaction
before insert on public.artist_interactions
for each row execute function public.require_fresh_artist_interaction();

drop trigger if exists trg_require_fresh_artist_vote on public.artist_votes;
create trigger trg_require_fresh_artist_vote
before insert on public.artist_votes
for each row execute function public.require_fresh_artist_interaction();

drop trigger if exists trg_require_fresh_chat_artist on public.chat_messages;
create trigger trg_require_fresh_chat_artist
before insert on public.chat_messages
for each row execute function public.require_fresh_artist_interaction();

drop trigger if exists trg_require_fresh_battle_artists on public.battles;
create trigger trg_require_fresh_battle_artists
before insert on public.battles
for each row execute function public.require_fresh_battle_artists();

revoke all on function public.is_artist_stream_fresh(uuid, uuid) from public, anon, authenticated;
revoke all on function public.heartbeat_artist_live(uuid) from public, anon;
grant execute on function public.heartbeat_artist_live(uuid) to authenticated;
revoke all on function public.expire_stale_room_presence() from public;
grant execute on function public.expire_stale_room_presence() to anon, authenticated;
revoke all on function public.require_fresh_artist_interaction() from public, anon, authenticated;
revoke all on function public.require_fresh_battle_artists() from public, anon, authenticated;

notify pgrst, 'reload schema';
