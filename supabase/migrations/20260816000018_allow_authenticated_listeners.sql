-- Every authenticated PALCO account can listen to another artist. A musician
-- keeps the artist role while browsing lives, so media signaling cannot be
-- restricted to listener/venue profile roles.

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
  v_artist_id uuid;
begin
  if auth.uid() is null or p_topic is null then
    return false;
  end if;

  if p_topic ~ '^media-in:[0-9a-fA-F-]{36}:[0-9a-fA-F-]{36}$' then
    v_parts := string_to_array(p_topic, ':');
    v_room_id := v_parts[2]::uuid;
    v_artist_id := v_parts[3]::uuid;

    return auth.uid() <> v_artist_id
      and public.is_artist_stream_fresh(v_room_id, v_artist_id)
      and public.can_access_room_activity(v_room_id);
  end if;

  if p_topic ~ '^media-out:[0-9a-fA-F-]{36}:[0-9a-fA-F-]{36}$' then
    v_parts := string_to_array(p_topic, ':');
    v_room_id := v_parts[2]::uuid;
    v_artist_id := v_parts[3]::uuid;
    return auth.uid() = v_artist_id
      and public.is_artist_stream_fresh(v_room_id, v_artist_id);
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

revoke all on function public.can_send_realtime_room_topic(text) from public, anon;
grant execute on function public.can_send_realtime_room_topic(text) to authenticated;

notify pgrst, 'reload schema';
