-- Refresh room presence with database time. A client-side upsert omitted
-- last_seen_at on conflict and also allowed forged future timestamps.
create or replace function public.heartbeat_room_presence(p_room_id uuid)
returns public.room_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_presence public.room_participants;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not exists (
    select 1 from public.rooms where id = p_room_id and is_active = true
  ) then
    raise exception 'Sala indisponivel';
  end if;

  insert into public.room_participants (room_id, profile_id, role, last_seen_at)
  select p_room_id, p.id, p.role, now()
  from public.profiles p
  where p.id = auth.uid()
  on conflict (room_id, profile_id) do update
    set role = excluded.role,
        last_seen_at = now()
  returning * into v_presence;

  if not found then
    raise exception 'Perfil nao encontrado';
  end if;

  return v_presence;
end;
$$;

revoke insert, update on public.room_participants from anon, authenticated;
revoke all on function public.heartbeat_room_presence(uuid) from public, anon;
grant execute on function public.heartbeat_room_presence(uuid) to authenticated;

notify pgrst, 'reload schema';
