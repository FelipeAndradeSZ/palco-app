-- Harden PALCO's money-moving workflows.
-- All settlement operations happen in SECURITY DEFINER RPCs after validating
-- the authenticated user, artist role and live room membership.

create table if not exists public.battle_settlements (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null unique references public.battles(id) on delete cascade,
  payer_id uuid references public.profiles(id) on delete set null,
  winner_id uuid references public.profiles(id) on delete set null,
  gross_amount numeric(10,2) not null check (gross_amount >= 0),
  platform_fee numeric(10,2) not null check (platform_fee >= 0),
  net_amount numeric(10,2) not null check (net_amount >= 0),
  status text not null check (status in ('paid', 'refunded')),
  created_at timestamptz not null default now()
);

alter table public.battle_votes
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

update public.battle_votes bv
  set room_id = b.room_id
  from public.battles b
  where b.id = bv.battle_id
    and bv.room_id is null;

create index if not exists battle_votes_room_battle_idx
  on public.battle_votes(room_id, battle_id);

alter table public.battle_settlements enable row level security;

drop policy if exists "Battle participants can read settlements" on public.battle_settlements;
create policy "Battle participants can read settlements"
  on public.battle_settlements for select
  using (
    public.is_platform_admin()
    or auth.uid() in (payer_id, winner_id)
    or exists (
      select 1
      from public.battles b
      where b.id = battle_id
        and auth.uid() in (b.challenger_artist_id, b.opponent_artist_id)
    )
  );

-- Public clients must use the audited RPCs. SELECT remains available through RLS.
revoke insert, update, delete on public.battles from anon, authenticated;
revoke insert, update, delete on public.battle_votes from anon, authenticated;
revoke insert, update, delete on public.artist_interactions from anon, authenticated;
revoke update, delete on public.song_requests from anon, authenticated;
revoke update, delete on public.chat_messages from anon, authenticated;
revoke insert, update, delete on public.wallets from anon, authenticated;
revoke insert, update, delete on public.transactions from anon, authenticated;
revoke insert, update, delete on public.withdrawal_requests from anon, authenticated;
revoke insert, update, delete on public.artist_votes from anon, authenticated;
revoke insert, update, delete on public.rooms from anon, authenticated;
revoke execute on function public.credit_wallet_topup(text, numeric, uuid) from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_has_explicit_role boolean;
begin
  v_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'listener'));
  v_has_explicit_role := v_role in ('listener', 'artist', 'venue');

  if not v_has_explicit_role then
    v_role := 'listener';
  end if;

  insert into public.profiles (id, name, role, avatar_url, onboarding_completed)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      'Usuario ' || substr(new.id::text, 1, 5)
    ),
    v_role::public.user_role,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    new.raw_user_meta_data ? 'role' and v_has_explicit_role
  )
  on conflict (id) do nothing;

  insert into public.wallets (profile_id, balance)
  values (new.id, 0)
  on conflict (profile_id) do nothing;

  if v_role = 'artist' then
    insert into public.artist_details (profile_id, main_genre, quality_tier, available_for_booking)
    values (
      new.id,
      nullif(trim(new.raw_user_meta_data ->> 'main_genre'), ''),
      'bronze',
      true
    )
    on conflict (profile_id) do update
      set main_genre = coalesce(excluded.main_genre, public.artist_details.main_genre);
  elsif v_role = 'venue' then
    insert into public.venue_profiles (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.on_chat_message_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or new.sender_id is distinct from auth.uid() then
    raise exception 'Remetente do chat invalido';
  end if;

  new.content := trim(new.content);
  if length(new.content) < 1 or length(new.content) > 500 then
    raise exception 'A mensagem deve ter entre 1 e 500 caracteres';
  end if;

  if new.artist_id is not null and not exists (
    select 1
    from public.room_artists
    where room_id = new.room_id
      and artist_id = new.artist_id
      and status = 'live'
  ) then
    raise exception 'O artista nao esta ao vivo nesta sala';
  end if;

  if new.message_type not in ('text', 'tip_alert', 'request_alert', 'system') then
    raise exception 'Tipo de mensagem invalido';
  end if;

  if new.message_type <> 'text' then
    new.message_type := 'text';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_validate_chat_message on public.chat_messages;
create trigger tr_validate_chat_message
  before insert on public.chat_messages
  for each row execute function public.on_chat_message_created();

create or replace function public.guard_artist_details_quality()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform_admin() then
    return new;
  end if;

  if auth.uid() is null and tg_op = 'INSERT' and exists (
    select 1 from public.profiles where id = new.profile_id and role = 'artist'
  ) then
    new.quality_tier := 'bronze';
    new.rating := 0;
    return new;
  end if;

  if auth.uid() is null or new.profile_id is distinct from auth.uid() then
    raise exception 'Perfil artistico invalido';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'artist'
  ) then
    raise exception 'Apenas artistas podem editar dados artisticos';
  end if;

  if tg_op = 'INSERT' then
    new.quality_tier := 'bronze';
    new.rating := 0;
  else
    new.quality_tier := old.quality_tier;
    new.rating := old.rating;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_guard_artist_details_quality on public.artist_details;
create trigger tr_guard_artist_details_quality
  before insert or update on public.artist_details
  for each row execute function public.guard_artist_details_quality();

create or replace function public.guard_booking_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if tg_op = 'INSERT' then
    new.venue_id := auth.uid();
    new.status := 'pending';

    if not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'venue'
    ) then
      raise exception 'Apenas estabelecimentos podem solicitar contratacao';
    end if;

    if not exists (
      select 1
      from public.profiles p
      join public.artist_details ad on ad.profile_id = p.id
      where p.id = new.artist_id
        and p.role = 'artist'
        and ad.available_for_booking = true
    ) then
      raise exception 'Artista indisponivel para contratacao';
    end if;

    if new.budget is not null and (new.budget <= 0 or new.budget > 1000000) then
      raise exception 'Orcamento invalido';
    end if;

    if length(coalesce(new.message, '')) > 1000 then
      raise exception 'Mensagem de contratacao muito longa';
    end if;

    return new;
  end if;

  if new.venue_id is distinct from old.venue_id
     or new.artist_id is distinct from old.artist_id
     or new.event_date is distinct from old.event_date
     or new.city is distinct from old.city
     or new.state is distinct from old.state
     or new.message is distinct from old.message
     or new.budget is distinct from old.budget
     or new.created_at is distinct from old.created_at then
    raise exception 'Dados originais da solicitacao nao podem ser alterados';
  end if;

  if auth.uid() = old.artist_id
     and old.status = 'pending'
     and new.status in ('accepted', 'declined') then
    return new;
  end if;

  if auth.uid() = old.venue_id
     and old.status in ('pending', 'accepted')
     and new.status = 'cancelled' then
    return new;
  end if;

  raise exception 'Transicao de status da contratacao nao permitida';
end;
$$;

drop trigger if exists tr_guard_booking_request_insert on public.booking_requests;
create trigger tr_guard_booking_request_insert
  before insert on public.booking_requests
  for each row execute function public.guard_booking_request();

drop trigger if exists tr_guard_booking_request_update on public.booking_requests;
create trigger tr_guard_booking_request_update
  before update on public.booking_requests
  for each row execute function public.guard_booking_request();

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
      room_id, artist_id, status, started_at, ended_at, updated_at
    ) values (
      p_room_id, auth.uid(), 'live', now(), null, now()
    )
    on conflict (room_id, artist_id) do update
      set status = 'live', started_at = now(), ended_at = null, updated_at = now()
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
    where room_id = p_room_id and status = 'live'
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

revoke insert, update, delete on public.room_artists from anon, authenticated;

create or replace function public.on_song_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if new.requester_id is distinct from auth.uid() then
    raise exception 'Solicitante invalido';
  end if;

  if nullif(trim(new.song_title), '') is null then
    raise exception 'Informe a musica do pedido';
  end if;

  if new.bounty_value < 5 or new.bounty_value > 500 then
    raise exception 'Valor do pedido deve ficar entre R$ 5,00 e R$ 500,00';
  end if;

  if new.target_artist_id is not null and not exists (
    select 1
    from public.room_artists ra
    join public.profiles p on p.id = ra.artist_id and p.role = 'artist'
    where ra.room_id = new.room_id
      and ra.artist_id = new.target_artist_id
      and ra.status = 'live'
  ) then
    raise exception 'O artista escolhido nao esta ao vivo nesta sala';
  end if;

  new.status := 'pending';
  new.accepted_by := null;
  new.accepted_at := null;
  new.transaction_id := null;

  update public.wallets
    set balance = balance - new.bounty_value
    where profile_id = auth.uid()
      and balance >= new.bounty_value;

  if not found then
    raise exception 'Saldo insuficiente para realizar o pedido musical';
  end if;

  return new;
end;
$$;

create or replace function public.on_song_request_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status in ('pending', 'accepted', 'playing')
     and new.status = 'cancelled'
     and old.transaction_id is null
     and old.bounty_value > 0 then
    update public.wallets
      set balance = balance + old.bounty_value
      where profile_id = old.requester_id;
  end if;

  return new;
end;
$$;

create or replace function public.process_song_request(
  p_request_id uuid,
  p_artist_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.song_requests%rowtype;
begin
  if auth.uid() is null or auth.uid() is distinct from p_artist_id then
    raise exception 'Artista nao autenticado';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'artist'
  ) then
    raise exception 'Apenas artistas podem aceitar pedidos';
  end if;

  select * into v_request
  from public.song_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Pedido nao encontrado ou ja processado';
  end if;

  if v_request.target_artist_id is not null
     and v_request.target_artist_id is distinct from auth.uid() then
    raise exception 'Este pedido foi direcionado para outro artista';
  end if;

  if not exists (
    select 1 from public.room_artists
    where room_id = v_request.room_id
      and artist_id = auth.uid()
      and status = 'live'
  ) then
    raise exception 'Entre ao vivo nesta sala antes de aceitar pedidos';
  end if;

  update public.song_requests
    set status = 'accepted',
        accepted_by = auth.uid(),
        accepted_at = now()
    where id = p_request_id;
end;
$$;

create or replace function public.complete_song_request(p_request_id uuid)
returns public.song_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.song_requests%rowtype;
  v_platform_fee numeric(10,2);
  v_artist_amount numeric(10,2);
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  select * into v_request
  from public.song_requests
  where id = p_request_id
    and status in ('accepted', 'playing')
    and accepted_by = auth.uid()
    and transaction_id is null
  for update;

  if not found then
    raise exception 'Pedido indisponivel para conclusao';
  end if;

  v_platform_fee := round(v_request.bounty_value * 0.10, 2);
  v_artist_amount := v_request.bounty_value - v_platform_fee;

  insert into public.wallets (profile_id, balance)
  values (auth.uid(), 0)
  on conflict (profile_id) do nothing;

  insert into public.transactions (
    sender_id, receiver_id, amount, platform_fee, type, status, metadata
  ) values (
    v_request.requester_id,
    auth.uid(),
    v_request.bounty_value,
    v_platform_fee,
    'song_request'::public.transaction_type,
    'completed'::public.transaction_status,
    jsonb_build_object(
      'song_request_id', v_request.id,
      'song_title', v_request.song_title
    )
  ) returning id into v_transaction_id;

  update public.wallets
    set balance = balance + v_artist_amount
    where profile_id = auth.uid();

  update public.song_requests
    set status = 'completed',
        transaction_id = v_transaction_id
    where id = p_request_id
    returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.cancel_song_request(p_request_id uuid)
returns public.song_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.song_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  select * into v_request
  from public.song_requests
  where id = p_request_id
    and status in ('pending', 'accepted', 'playing')
  for update;

  if not found then
    raise exception 'Pedido indisponivel para cancelamento';
  end if;

  if auth.uid() is distinct from v_request.requester_id
     and auth.uid() is distinct from v_request.target_artist_id
     and auth.uid() is distinct from v_request.accepted_by then
    raise exception 'Voce nao pode cancelar este pedido';
  end if;

  update public.song_requests
    set status = 'cancelled'
    where id = p_request_id
    returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.send_artist_tip(
  target_room_id uuid,
  target_artist_id uuid,
  tip_amount numeric,
  tip_message text default null
)
returns public.artist_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_interaction public.artist_interactions;
  v_transaction_id uuid;
  v_platform_fee numeric(10,2);
  v_artist_amount numeric(10,2);
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if target_artist_id is null or target_artist_id = auth.uid() then
    raise exception 'Artista de destino invalido';
  end if;

  if tip_amount < 5 or tip_amount > 500 then
    raise exception 'Valor da gorjeta deve ficar entre R$ 5,00 e R$ 500,00';
  end if;

  if not exists (
    select 1
    from public.room_artists ra
    join public.profiles p on p.id = ra.artist_id and p.role = 'artist'
    where ra.room_id = target_room_id
      and ra.artist_id = target_artist_id
      and ra.status = 'live'
  ) then
    raise exception 'O artista nao esta ao vivo nesta sala';
  end if;

  insert into public.wallets (profile_id, balance)
  values (target_artist_id, 0)
  on conflict (profile_id) do nothing;

  update public.wallets
    set balance = balance - tip_amount
    where profile_id = auth.uid()
      and balance >= tip_amount;

  if not found then
    raise exception 'Saldo insuficiente';
  end if;

  v_platform_fee := round(tip_amount * 0.10, 2);
  v_artist_amount := tip_amount - v_platform_fee;

  update public.wallets
    set balance = balance + v_artist_amount
    where profile_id = target_artist_id;

  insert into public.transactions (
    sender_id, receiver_id, amount, platform_fee, type, status, metadata
  ) values (
    auth.uid(),
    target_artist_id,
    tip_amount,
    v_platform_fee,
    'tip'::public.transaction_type,
    'completed'::public.transaction_status,
    jsonb_build_object('message', nullif(trim(tip_message), ''))
  ) returning id into v_transaction_id;

  insert into public.artist_interactions (
    room_id, artist_id, sender_id, interaction_type, amount, message, metadata
  ) values (
    target_room_id,
    target_artist_id,
    auth.uid(),
    'tip',
    tip_amount,
    nullif(trim(tip_message), ''),
    jsonb_build_object(
      'artist_share', v_artist_amount,
      'platform_fee', v_platform_fee,
      'transaction_id', v_transaction_id
    )
  ) returning * into v_interaction;

  return v_interaction;
end;
$$;

create or replace function public.request_withdrawal(
  p_amount numeric,
  p_pix_key text
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance numeric;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'artist'
  ) then
    raise exception 'Apenas artistas podem solicitar saque';
  end if;

  if p_amount < 10 or p_amount > 5000 then
    raise exception 'O saque deve ficar entre R$ 10,00 e R$ 5.000,00';
  end if;

  if nullif(trim(p_pix_key), '') is null or length(trim(p_pix_key)) > 180 then
    raise exception 'Chave PIX invalida';
  end if;

  if exists (
    select 1 from public.withdrawal_requests
    where profile_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'Voce ja possui um saque pendente';
  end if;

  update public.wallets
    set balance = balance - p_amount
    where profile_id = auth.uid()
      and balance >= p_amount;

  if not found then
    raise exception 'Saldo insuficiente para realizar o saque';
  end if;

  insert into public.withdrawal_requests (profile_id, amount, pix_key, status)
  values (auth.uid(), p_amount, trim(p_pix_key), 'pending');

  select balance into v_current_balance
  from public.wallets
  where profile_id = auth.uid();

  return coalesce(v_current_balance, 0);
end;
$$;

create or replace function public.complete_manual_withdrawal(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.withdrawal_requests%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas administradores podem confirmar saques';
  end if;

  select * into v_request
  from public.withdrawal_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Solicitacao de saque nao encontrada ou ja processada';
  end if;

  update public.withdrawal_requests
    set status = 'completed', processed_at = now()
    where id = p_request_id;

  insert into public.transactions (
    sender_id, receiver_id, amount, platform_fee, type, status, metadata
  ) values (
    v_request.profile_id,
    null,
    v_request.amount,
    0,
    'withdrawal'::public.transaction_type,
    'completed'::public.transaction_status,
    jsonb_build_object(
      'pix_key', v_request.pix_key,
      'processed_by', auth.uid(),
      'settlement', 'manual_pix'
    )
  );
end;
$$;

create or replace function public.reject_withdrawal(
  p_request_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.withdrawal_requests%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas administradores podem recusar saques';
  end if;

  select * into v_request
  from public.withdrawal_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Solicitacao de saque nao encontrada ou ja processada';
  end if;

  update public.withdrawal_requests
    set status = 'rejected',
        rejection_reason = nullif(trim(p_reason), ''),
        processed_at = now()
    where id = p_request_id;

  update public.wallets
    set balance = balance + v_request.amount
    where profile_id = v_request.profile_id;
end;
$$;

revoke execute on function public.simulate_approve_withdrawal(uuid) from anon, authenticated;
revoke execute on function public.simulate_reject_withdrawal(uuid, text) from anon, authenticated;

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
    set status = 'active', accepted_at = now(), updated_at = now()
    where id = p_battle_id
      and status = 'pending'
      and auth.uid() = opponent_artist_id
    returning * into v_battle;

  if not found then
    raise exception 'Somente o artista desafiado pode aceitar a batalha';
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
    set status = 'voting', voting_started_at = now(), updated_at = now()
    where id = p_battle_id
      and status = 'active'
      and auth.uid() in (challenger_artist_id, opponent_artist_id)
    returning * into v_battle;

  if not found then
    raise exception 'Batalha indisponivel para abrir votacao';
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
  v_battle public.battles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_category not in ('voice', 'interpretation', 'solo', 'presence') then
    raise exception 'Categoria de voto invalida';
  end if;

  select * into v_battle
  from public.battles
  where id = p_battle_id and status = 'voting';

  if not found or p_artist_id not in (v_battle.challenger_artist_id, v_battle.opponent_artist_id) then
    raise exception 'Batalha indisponivel para voto';
  end if;

  if auth.uid() in (v_battle.challenger_artist_id, v_battle.opponent_artist_id) then
    raise exception 'Participantes da batalha nao podem votar';
  end if;

  update public.battle_votes
    set artist_id = p_artist_id,
        room_id = v_battle.room_id,
        created_at = now()
    where battle_id = p_battle_id
      and voter_id = auth.uid()
      and category = p_category
    returning * into v_vote;

  if not found then
    insert into public.battle_votes (battle_id, room_id, voter_id, artist_id, category)
    values (p_battle_id, v_battle.room_id, auth.uid(), p_artist_id, p_category)
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
  v_battle public.battles%rowtype;
  v_winner uuid;
  v_challenger_votes bigint;
  v_opponent_votes bigint;
  v_fee numeric(10,2);
  v_net numeric(10,2);
begin
  select * into v_battle
  from public.battles
  where id = p_battle_id
    and status = 'voting'
    and auth.uid() in (challenger_artist_id, opponent_artist_id)
  for update;

  if not found then
    raise exception 'Batalha indisponivel para encerramento';
  end if;

  select count(*) filter (where artist_id = v_battle.challenger_artist_id),
         count(*) filter (where artist_id = v_battle.opponent_artist_id)
    into v_challenger_votes, v_opponent_votes
  from public.battle_votes
  where battle_id = p_battle_id;

  if v_challenger_votes > v_opponent_votes then
    v_winner := v_battle.challenger_artist_id;
  elsif v_opponent_votes > v_challenger_votes then
    v_winner := v_battle.opponent_artist_id;
  else
    v_winner := null;
  end if;

  if v_battle.bounty_paid and v_battle.bounty_value > 0 then
    if v_winner is null then
      update public.wallets
        set balance = balance + v_battle.bounty_value
        where profile_id = v_battle.requester_id;

      insert into public.battle_settlements (
        battle_id, payer_id, winner_id, gross_amount, platform_fee, net_amount, status
      ) values (
        v_battle.id, v_battle.requester_id, null, v_battle.bounty_value, 0, v_battle.bounty_value, 'refunded'
      );
    else
      v_fee := round(v_battle.bounty_value * 0.10, 2);
      v_net := v_battle.bounty_value - v_fee;

      insert into public.wallets (profile_id, balance)
      values (v_winner, 0)
      on conflict (profile_id) do nothing;

      update public.wallets
        set balance = balance + v_net
        where profile_id = v_winner;

      insert into public.battle_settlements (
        battle_id, payer_id, winner_id, gross_amount, platform_fee, net_amount, status
      ) values (
        v_battle.id, v_battle.requester_id, v_winner, v_battle.bounty_value, v_fee, v_net, 'paid'
      );
    end if;
  end if;

  update public.battles
    set status = 'finished',
        winner_id = v_winner,
        bounty_paid = false,
        finished_at = now(),
        updated_at = now()
    where id = p_battle_id
    returning * into v_battle;

  return v_battle;
end;
$$;

grant execute on function public.process_song_request(uuid, uuid) to authenticated;
grant execute on function public.complete_song_request(uuid) to authenticated;
grant execute on function public.cancel_song_request(uuid) to authenticated;
grant execute on function public.send_artist_tip(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.request_withdrawal(numeric, text) to authenticated;
grant execute on function public.complete_manual_withdrawal(uuid) to authenticated;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated;
grant execute on function public.accept_battle(uuid) to authenticated;
grant execute on function public.start_battle_voting(uuid) to authenticated;
grant execute on function public.vote_battle(uuid, uuid, text) to authenticated;
grant execute on function public.finish_battle(uuid, uuid) to authenticated;
grant execute on function public.set_artist_live_state(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
