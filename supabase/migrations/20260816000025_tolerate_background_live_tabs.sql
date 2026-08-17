-- Browsers may throttle background tabs to one timer per minute or suspend
-- them briefly. A 90 second deadline caused healthy live shows to disappear.

create or replace function public.palco_presence_timeout()
returns interval
language sql
immutable
set search_path = public
as $$
  select interval '5 minutes';
$$;

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
      and last_heartbeat_at > now() - public.palco_presence_timeout()
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
      and last_heartbeat_at > now() - public.palco_presence_timeout()
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
     and last_heartbeat_at <= now() - public.palco_presence_timeout();
  get diagnostics v_expired_artists = row_count;

  delete from public.room_participants
   where last_seen_at <= now() - public.palco_presence_timeout();
  get diagnostics v_expired_participants = row_count;

  update public.rooms r
     set current_artist_id = (
       select ra.artist_id
       from public.room_artists ra
       where ra.room_id = r.id
         and ra.status = 'live'
         and ra.last_heartbeat_at > now() - public.palco_presence_timeout()
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

create or replace function public.can_access_room_activity(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_platform_admin()
    or exists (
      select 1
      from public.room_participants rp
      where rp.room_id = p_room_id
        and rp.profile_id = auth.uid()
        and rp.last_seen_at > now() - public.palco_presence_timeout()
    )
    or public.is_artist_stream_fresh(p_room_id, auth.uid())
  );
$$;

create or replace function public.can_access_realtime_room_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parts text[];
  v_room_id uuid;
  v_artist_id uuid;
begin
  if auth.uid() is null or p_topic is null then
    return false;
  end if;

  if p_topic ~ '^media:[0-9a-fA-F-]{36}:[0-9a-fA-F-]{36}$' then
    v_parts := string_to_array(p_topic, ':');
    v_room_id := v_parts[2]::uuid;
    v_artist_id := v_parts[3]::uuid;

    return public.is_artist_stream_fresh(v_room_id, v_artist_id)
      and (
        public.is_platform_admin()
        or public.is_artist_stream_fresh(v_room_id, auth.uid())
        or exists (
          select 1
          from public.room_participants rp
          where rp.room_id = v_room_id
            and rp.profile_id = auth.uid()
            and rp.last_seen_at > now() - public.palco_presence_timeout()
        )
      );
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

revoke all on function public.palco_presence_timeout() from public, anon, authenticated;
revoke all on function public.is_artist_stream_fresh(uuid, uuid) from public, anon, authenticated;
revoke all on function public.expire_stale_room_presence() from public, anon, authenticated;
revoke all on function public.can_access_room_activity(uuid) from public, anon;
grant execute on function public.can_access_room_activity(uuid) to authenticated;
revoke all on function public.can_access_realtime_room_topic(text) from public, anon;
grant execute on function public.can_access_realtime_room_topic(text) to authenticated;

notify pgrst, 'reload schema';
