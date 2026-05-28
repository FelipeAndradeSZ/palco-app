-- Ensure remote battle tables created by earlier attempts expose stable FK names
-- for PostgREST nested selects used by the app.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'battles_room_id_fkey'
      and conrelid = 'public.battles'::regclass
  ) then
    alter table public.battles
      add constraint battles_room_id_fkey
      foreign key (room_id) references public.rooms(id) on delete cascade not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'battles_requester_id_fkey'
      and conrelid = 'public.battles'::regclass
  ) then
    alter table public.battles
      add constraint battles_requester_id_fkey
      foreign key (requester_id) references public.profiles(id) on delete set null not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'battles_challenger_artist_id_fkey'
      and conrelid = 'public.battles'::regclass
  ) then
    alter table public.battles
      add constraint battles_challenger_artist_id_fkey
      foreign key (challenger_artist_id) references public.profiles(id) on delete cascade not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'battles_opponent_artist_id_fkey'
      and conrelid = 'public.battles'::regclass
  ) then
    alter table public.battles
      add constraint battles_opponent_artist_id_fkey
      foreign key (opponent_artist_id) references public.profiles(id) on delete cascade not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'battles_winner_id_fkey'
      and conrelid = 'public.battles'::regclass
  ) then
    alter table public.battles
      add constraint battles_winner_id_fkey
      foreign key (winner_id) references public.profiles(id) on delete set null not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'battle_votes_battle_id_fkey'
      and conrelid = 'public.battle_votes'::regclass
  ) then
    alter table public.battle_votes
      add constraint battle_votes_battle_id_fkey
      foreign key (battle_id) references public.battles(id) on delete cascade not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'battle_votes_voter_id_fkey'
      and conrelid = 'public.battle_votes'::regclass
  ) then
    alter table public.battle_votes
      add constraint battle_votes_voter_id_fkey
      foreign key (voter_id) references public.profiles(id) on delete cascade not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'battle_votes_artist_id_fkey'
      and conrelid = 'public.battle_votes'::regclass
  ) then
    alter table public.battle_votes
      add constraint battle_votes_artist_id_fkey
      foreign key (artist_id) references public.profiles(id) on delete cascade not valid;
  end if;
end $$;

notify pgrst, 'reload schema';

