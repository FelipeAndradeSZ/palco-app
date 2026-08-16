-- Only current room members may create room activity. Artists are considered
-- present while their stream heartbeat is fresh.

create or replace function public.require_room_presence_for_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para interagir nesta sala';
  end if;

  v_room_id := nullif(to_jsonb(new) ->> 'room_id', '')::uuid;

  if v_room_id is null or not public.can_access_room_activity(v_room_id) then
    raise exception 'Entre na sala antes de interagir';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_require_room_presence_chat on public.chat_messages;
create trigger trg_require_room_presence_chat
before insert on public.chat_messages
for each row execute function public.require_room_presence_for_activity();

drop trigger if exists trg_require_room_presence_request on public.song_requests;
create trigger trg_require_room_presence_request
before insert on public.song_requests
for each row execute function public.require_room_presence_for_activity();

drop trigger if exists trg_require_room_presence_interaction on public.artist_interactions;
create trigger trg_require_room_presence_interaction
before insert on public.artist_interactions
for each row execute function public.require_room_presence_for_activity();

drop trigger if exists trg_require_room_presence_artist_vote on public.artist_votes;
create trigger trg_require_room_presence_artist_vote
before insert on public.artist_votes
for each row execute function public.require_room_presence_for_activity();

drop trigger if exists trg_require_room_presence_battle on public.battles;
create trigger trg_require_room_presence_battle
before insert on public.battles
for each row execute function public.require_room_presence_for_activity();

drop trigger if exists trg_require_room_presence_battle_vote on public.battle_votes;
create trigger trg_require_room_presence_battle_vote
before insert on public.battle_votes
for each row execute function public.require_room_presence_for_activity();

revoke all on function public.require_room_presence_for_activity() from public, anon, authenticated;

notify pgrst, 'reload schema';
