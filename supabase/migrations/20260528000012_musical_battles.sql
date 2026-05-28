-- PALCO musical battles.
-- Non-destructive: never drops production battle data.

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  requester_id uuid references public.profiles(id) on delete set null,
  challenger_artist_id uuid not null references public.profiles(id) on delete cascade,
  opponent_artist_id uuid not null references public.profiles(id) on delete cascade,
  song_title text not null,
  source text not null default 'listener' check (source in ('listener', 'artist')),
  bounty_value numeric(10,2) not null default 0 check (bounty_value >= 0),
  bounty_paid boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'active', 'voting', 'finished', 'cancelled')),
  winner_id uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  voting_started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint battles_distinct_artists check (challenger_artist_id <> opponent_artist_id)
);

create table if not exists public.battle_votes (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('voice', 'interpretation', 'solo', 'presence')),
  created_at timestamptz not null default now(),
  constraint battle_votes_unique_per_category unique (battle_id, voter_id, category)
);

-- A previous remote-only migration created battle tables with a different shape.
-- Add every column used by the current app instead of dropping those production tables.
alter table public.battles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists room_id uuid references public.rooms(id) on delete cascade,
  add column if not exists requester_id uuid references public.profiles(id) on delete set null,
  add column if not exists challenger_artist_id uuid references public.profiles(id) on delete cascade,
  add column if not exists opponent_artist_id uuid references public.profiles(id) on delete cascade,
  add column if not exists song_title text,
  add column if not exists source text not null default 'listener',
  add column if not exists bounty_value numeric(10,2) not null default 0,
  add column if not exists bounty_paid boolean not null default false,
  add column if not exists status text not null default 'pending',
  add column if not exists winner_id uuid references public.profiles(id) on delete set null,
  add column if not exists accepted_at timestamptz,
  add column if not exists voting_started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.battle_votes
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists battle_id uuid references public.battles(id) on delete cascade,
  add column if not exists voter_id uuid references public.profiles(id) on delete cascade,
  add column if not exists artist_id uuid references public.profiles(id) on delete cascade,
  add column if not exists category text,
  add column if not exists created_at timestamptz not null default now();

alter table public.battles alter column id set default gen_random_uuid();
alter table public.battle_votes alter column id set default gen_random_uuid();

create index if not exists battles_room_status_idx on public.battles(room_id, status, created_at desc);
create index if not exists battles_artist_status_idx on public.battles(challenger_artist_id, opponent_artist_id, status);
create index if not exists battle_votes_battle_artist_idx on public.battle_votes(battle_id, artist_id);

alter table public.battles enable row level security;
alter table public.battle_votes enable row level security;

drop policy if exists "Battles are readable by everyone" on public.battles;
create policy "Battles are readable by everyone"
  on public.battles for select
  using (true);

drop policy if exists "Authenticated users can create battle requests" on public.battles;
create policy "Authenticated users can create battle requests"
  on public.battles for insert
  with check (
    auth.uid() is not null
    and (
      auth.uid() = requester_id
      or auth.uid() = challenger_artist_id
    )
  );

drop policy if exists "Battle artists can update battles" on public.battles;
create policy "Battle artists can update battles"
  on public.battles for update
  using (auth.uid() in (challenger_artist_id, opponent_artist_id));

drop policy if exists "Battle votes are readable by everyone" on public.battle_votes;
create policy "Battle votes are readable by everyone"
  on public.battle_votes for select
  using (true);

drop policy if exists "Authenticated users can vote in battles" on public.battle_votes;
create policy "Authenticated users can vote in battles"
  on public.battle_votes for insert
  with check (auth.uid() = voter_id);

create or replace function public.get_battle_results(p_battle_id uuid)
returns table (
  artist_id uuid,
  category text,
  vote_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select bv.artist_id, bv.category, count(*)::bigint as vote_count
  from public.battle_votes bv
  where bv.battle_id = p_battle_id
  group by bv.artist_id, bv.category;
$$;

create or replace function public.create_battle(
  p_room_id uuid,
  p_challenger_artist_id uuid,
  p_opponent_artist_id uuid,
  p_song_title text,
  p_bounty_value numeric default 0
)
returns public.battles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battle public.battles;
  v_source text;
  v_bounty numeric(10,2);
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  select role::text into v_role from public.profiles where id = auth.uid();
  v_source := case when auth.uid() = p_challenger_artist_id and v_role = 'artist' then 'artist' else 'listener' end;
  v_bounty := coalesce(p_bounty_value, 0);

  if p_challenger_artist_id is null or p_opponent_artist_id is null or p_challenger_artist_id = p_opponent_artist_id then
    raise exception 'Escolha dois artistas diferentes para a batalha';
  end if;

  if nullif(trim(p_song_title), '') is null then
    raise exception 'Informe a musica da batalha';
  end if;

  if not exists (
    select 1 from public.room_artists
    where room_id = p_room_id
      and artist_id in (p_challenger_artist_id, p_opponent_artist_id)
      and status = 'live'
    group by room_id
    having count(distinct artist_id) = 2
  ) then
    raise exception 'Os dois artistas precisam estar ao vivo na sala';
  end if;

  if v_source = 'listener' and v_bounty < 5 then
    raise exception 'Batalha paga precisa ter valor minimo de R$ 5,00';
  end if;

  if v_bounty > 0 then
    update public.wallets
      set balance = balance - v_bounty
      where profile_id = auth.uid()
        and balance >= v_bounty;

    if not found then
      raise exception 'Saldo insuficiente para iniciar a batalha';
    end if;
  end if;

  insert into public.battles (
    room_id,
    requester_id,
    challenger_artist_id,
    opponent_artist_id,
    song_title,
    source,
    bounty_value,
    bounty_paid,
    status
  ) values (
    p_room_id,
    auth.uid(),
    p_challenger_artist_id,
    p_opponent_artist_id,
    trim(p_song_title),
    v_source,
    v_bounty,
    v_bounty > 0,
    'pending'
  )
  returning * into v_battle;

  return v_battle;
exception
  when others then
    raise;
end;
$$;

create or replace function public.accept_battle(p_battle_id uuid)
returns public.battles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battle public.battles;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  update public.battles
    set status = 'active',
        accepted_at = now(),
        updated_at = now()
    where id = p_battle_id
      and status = 'pending'
      and auth.uid() in (challenger_artist_id, opponent_artist_id)
    returning * into v_battle;

  if not found then
    raise exception 'Batalha nao encontrada ou voce nao pode aceitar';
  end if;

  return v_battle;
end;
$$;

create or replace function public.start_battle_voting(p_battle_id uuid)
returns public.battles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battle public.battles;
begin
  update public.battles
    set status = 'voting',
        voting_started_at = now(),
        updated_at = now()
    where id = p_battle_id
      and status in ('active', 'pending')
      and auth.uid() in (challenger_artist_id, opponent_artist_id)
    returning * into v_battle;

  if not found then
    raise exception 'Batalha nao encontrada ou voce nao pode abrir votacao';
  end if;

  return v_battle;
end;
$$;

create or replace function public.vote_battle(
  p_battle_id uuid,
  p_artist_id uuid,
  p_category text
)
returns public.battle_votes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote public.battle_votes;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not exists (
    select 1 from public.battles
    where id = p_battle_id
      and status in ('active', 'voting')
      and p_artist_id in (challenger_artist_id, opponent_artist_id)
  ) then
    raise exception 'Batalha indisponivel para voto';
  end if;

  update public.battle_votes
    set artist_id = p_artist_id,
        created_at = now()
    where battle_id = p_battle_id
      and voter_id = auth.uid()
      and category = p_category
    returning * into v_vote;

  if not found then
    insert into public.battle_votes (battle_id, voter_id, artist_id, category)
    values (p_battle_id, auth.uid(), p_artist_id, p_category)
    returning * into v_vote;
  end if;

  return v_vote;
end;
$$;

create or replace function public.finish_battle(
  p_battle_id uuid,
  p_winner_id uuid default null
)
returns public.battles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battle public.battles;
  v_winner uuid;
begin
  select * into v_battle
  from public.battles
  where id = p_battle_id
    and status in ('active', 'voting')
    and auth.uid() in (challenger_artist_id, opponent_artist_id)
  for update;

  if not found then
    raise exception 'Batalha nao encontrada ou voce nao pode encerrar';
  end if;

  v_winner := p_winner_id;

  if v_winner is null then
    select artist_id into v_winner
    from public.battle_votes
    where battle_id = p_battle_id
    group by artist_id
    order by count(*) desc, max(created_at) asc
    limit 1;
  end if;

  if v_winner is not null and v_winner not in (v_battle.challenger_artist_id, v_battle.opponent_artist_id) then
    raise exception 'Vencedor invalido';
  end if;

  if v_battle.bounty_paid and v_battle.bounty_value > 0 and v_winner is not null then
    insert into public.wallets (profile_id, balance)
    values (v_winner, 0)
    on conflict (profile_id) do nothing;

    update public.wallets
      set balance = balance + round(v_battle.bounty_value * 0.90, 2)
      where profile_id = v_winner;
  end if;

  update public.battles
    set status = 'finished',
        winner_id = v_winner,
        finished_at = now(),
        updated_at = now()
    where id = p_battle_id
    returning * into v_battle;

  return v_battle;
end;
$$;

create or replace function public.cancel_battle(p_battle_id uuid)
returns public.battles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battle public.battles;
begin
  select * into v_battle
  from public.battles
  where id = p_battle_id
    and status in ('pending', 'active', 'voting')
    and auth.uid() in (requester_id, challenger_artist_id, opponent_artist_id)
  for update;

  if not found then
    raise exception 'Batalha nao encontrada ou voce nao pode cancelar';
  end if;

  if v_battle.bounty_paid and v_battle.bounty_value > 0 and v_battle.requester_id is not null then
    update public.wallets
      set balance = balance + v_battle.bounty_value
      where profile_id = v_battle.requester_id;
  end if;

  update public.battles
    set status = 'cancelled',
        bounty_paid = false,
        updated_at = now(),
        finished_at = now()
    where id = p_battle_id
    returning * into v_battle;

  return v_battle;
end;
$$;

grant execute on function public.get_battle_results(uuid) to anon, authenticated;
grant execute on function public.create_battle(uuid, uuid, uuid, text, numeric) to authenticated;
grant execute on function public.accept_battle(uuid) to authenticated;
grant execute on function public.start_battle_voting(uuid) to authenticated;
grant execute on function public.vote_battle(uuid, uuid, text) to authenticated;
grant execute on function public.finish_battle(uuid, uuid) to authenticated;
grant execute on function public.cancel_battle(uuid) to authenticated;

do $$
begin
  begin
    alter table public.battles replica identity full;
    alter publication supabase_realtime add table public.battles;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter table public.battle_votes replica identity full;
    alter publication supabase_realtime add table public.battle_votes;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
