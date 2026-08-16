-- Protect client Broadcast topics used by WebRTC signaling and live reactions.

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
            and rp.last_seen_at > now() - interval '90 seconds'
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

drop policy if exists "PALCO members receive private broadcasts" on realtime.messages;
create policy "PALCO members receive private broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.can_access_realtime_room_topic(realtime.topic())
  );

drop policy if exists "PALCO members send private broadcasts" on realtime.messages;
create policy "PALCO members send private broadcasts"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and public.can_access_realtime_room_topic(realtime.topic())
  );

revoke all on function public.can_access_realtime_room_topic(text) from public, anon;
grant execute on function public.can_access_realtime_room_topic(text) to authenticated;

notify pgrst, 'reload schema';
