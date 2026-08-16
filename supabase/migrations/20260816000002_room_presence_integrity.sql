-- Keep room presence authoritative even when a client tampers with its payload.

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

  select role::text
    into v_profile_role
    from public.profiles
    where id = auth.uid();

  if v_profile_role is null then
    raise exception 'Perfil nao encontrado';
  end if;

  if new.role::text is distinct from v_profile_role then
    raise exception 'Papel do participante nao corresponde ao perfil';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_room_participant_identity on public.room_participants;
create trigger trg_guard_room_participant_identity
before insert or update on public.room_participants
for each row execute function public.guard_room_participant_identity();

create or replace function public.refresh_room_listener_count(p_room_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.rooms
     set listener_count = (
       select count(*)::integer
       from public.room_participants
       where room_id = p_room_id
         and role::text <> 'artist'
     )
   where id = p_room_id;
$$;

create or replace function public.sync_room_listener_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists trg_sync_room_listener_count on public.room_participants;
create trigger trg_sync_room_listener_count
after insert or update or delete on public.room_participants
for each row execute function public.sync_room_listener_count();

do $$
declare
  v_room record;
begin
  for v_room in select id from public.rooms loop
    perform public.refresh_room_listener_count(v_room.id);
  end loop;
end;
$$;

revoke all on function public.refresh_room_listener_count(uuid) from public, anon, authenticated;
revoke all on function public.sync_room_listener_count() from public, anon, authenticated;
revoke all on function public.guard_room_participant_identity() from public, anon, authenticated;

notify pgrst, 'reload schema';
