-- Keep artist profiles internally consistent and make artist voting reproducible
-- from the repository instead of depending on remote-only database functions.

update public.artist_details
set state = upper(trim(state))
where state is not null;

alter table public.profiles
  drop constraint if exists profiles_name_length_check,
  add constraint profiles_name_length_check
    check (char_length(trim(name)) between 2 and 150);

alter table public.artist_details
  drop constraint if exists artist_details_main_genre_required_check,
  add constraint artist_details_main_genre_required_check
    check (nullif(trim(main_genre), '') is not null and char_length(trim(main_genre)) <= 80),
  drop constraint if exists artist_details_bio_length_check,
  add constraint artist_details_bio_length_check
    check (bio is null or char_length(bio) <= 500),
  drop constraint if exists artist_details_repertoire_length_check,
  add constraint artist_details_repertoire_length_check
    check (repertoire is null or char_length(repertoire) <= 1000),
  drop constraint if exists artist_details_pix_key_length_check,
  add constraint artist_details_pix_key_length_check
    check (pix_key is null or char_length(pix_key) <= 180),
  drop constraint if exists artist_details_instagram_url_check,
  add constraint artist_details_instagram_url_check
    check (
      instagram_url is null
      or (
        char_length(instagram_url) <= 220
        and instagram_url ~* '^https?://[^[:space:]]+$'
      )
    ),
  drop constraint if exists artist_details_booking_whatsapp_length_check,
  add constraint artist_details_booking_whatsapp_length_check
    check (booking_whatsapp is null or char_length(booking_whatsapp) <= 40),
  drop constraint if exists artist_details_city_length_check,
  add constraint artist_details_city_length_check
    check (city is null or char_length(city) <= 120),
  drop constraint if exists artist_details_state_check,
  add constraint artist_details_state_check
    check (state is null or state ~ '^[A-Z]{2}$'),
  drop constraint if exists artist_details_region_check,
  add constraint artist_details_region_check
    check (region is null or region in ('norte', 'nordeste', 'centro-oeste', 'sudeste', 'sul'));

create or replace function public.save_own_profile(
  p_name text,
  p_main_genre text default null,
  p_bio text default null,
  p_repertoire text default null,
  p_pix_key text default null,
  p_instagram_url text default null,
  p_booking_whatsapp text default null,
  p_city text default null,
  p_state text default null,
  p_region text default null,
  p_available_for_booking boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_name text := nullif(trim(p_name), '');
  v_main_genre text := nullif(trim(p_main_genre), '');
  v_bio text := nullif(trim(p_bio), '');
  v_repertoire text := nullif(trim(p_repertoire), '');
  v_pix_key text := nullif(trim(p_pix_key), '');
  v_instagram_url text := nullif(trim(p_instagram_url), '');
  v_booking_whatsapp text := nullif(trim(p_booking_whatsapp), '');
  v_city text := nullif(trim(p_city), '');
  v_state text := nullif(upper(trim(p_state)), '');
  v_region text := nullif(trim(p_region), '');
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Perfil nao encontrado';
  end if;

  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 150 then
    raise exception 'Informe um nome entre 2 e 150 caracteres';
  end if;

  if v_profile.role::text = 'artist' and v_main_genre is null then
    raise exception 'Selecione o genero musical principal';
  end if;

  if v_instagram_url is not null and v_instagram_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'Informe um link profissional iniciado por http:// ou https://';
  end if;

  if v_state is not null and v_state !~ '^[A-Z]{2}$' then
    raise exception 'Informe o estado com duas letras';
  end if;

  if v_region is not null and v_region not in ('norte', 'nordeste', 'centro-oeste', 'sudeste', 'sul') then
    raise exception 'Regiao invalida';
  end if;

  update public.profiles
  set name = v_name
  where id = auth.uid();

  if v_profile.role::text = 'artist' then
    insert into public.artist_details (
      profile_id,
      main_genre,
      bio,
      repertoire,
      pix_key,
      instagram_url,
      booking_whatsapp,
      city,
      state,
      region,
      available_for_booking
    ) values (
      auth.uid(),
      v_main_genre,
      v_bio,
      v_repertoire,
      v_pix_key,
      v_instagram_url,
      v_booking_whatsapp,
      v_city,
      v_state,
      v_region,
      coalesce(p_available_for_booking, true)
    )
    on conflict (profile_id) do update set
      main_genre = excluded.main_genre,
      bio = excluded.bio,
      repertoire = excluded.repertoire,
      pix_key = excluded.pix_key,
      instagram_url = excluded.instagram_url,
      booking_whatsapp = excluded.booking_whatsapp,
      city = excluded.city,
      state = excluded.state,
      region = excluded.region,
      available_for_booking = excluded.available_for_booking;
  end if;

  return public.get_own_profile();
end;
$$;

revoke all on function public.save_own_profile(
  text, text, text, text, text, text, text, text, text, text, boolean
) from public, anon;
grant execute on function public.save_own_profile(
  text, text, text, text, text, text, text, text, text, text, boolean
) to authenticated;

create unique index if not exists artist_votes_one_per_category_idx
  on public.artist_votes(room_id, artist_id, voter_id, category);

drop function if exists public.get_artist_votes(uuid, uuid);
create or replace function public.get_artist_votes(
  p_room_id uuid,
  p_artist_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.can_access_room_activity(p_room_id)
     and auth.uid() <> p_artist_id
     and not public.is_platform_admin() then
    raise exception 'Entre na sala para acompanhar os votos';
  end if;

  select jsonb_build_object(
    'voice', count(*) filter (where category = 'voice'),
    'repertoire', count(*) filter (where category = 'repertoire'),
    'presence', count(*) filter (where category = 'presence'),
    'user_votes', coalesce(
      jsonb_agg(category order by category) filter (where voter_id = auth.uid()),
      '[]'::jsonb
    )
  ) into v_result
  from public.artist_votes
  where room_id = p_room_id
    and artist_id = p_artist_id;

  return v_result;
end;
$$;

drop function if exists public.cast_artist_vote(uuid, uuid, text);
create or replace function public.cast_artist_vote(
  p_room_id uuid,
  p_artist_id uuid,
  p_category text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_category not in ('voice', 'repertoire', 'presence') then
    raise exception 'Categoria de voto invalida';
  end if;

  if auth.uid() = p_artist_id then
    raise exception 'O artista nao pode votar em si mesmo';
  end if;

  if not public.can_access_room_activity(p_room_id) then
    raise exception 'Entre na sala para votar';
  end if;

  if not public.is_artist_stream_fresh(p_room_id, p_artist_id) then
    raise exception 'O artista nao esta mais transmitindo nesta sala';
  end if;

  if exists (
    select 1
    from public.artist_votes
    where room_id = p_room_id
      and artist_id = p_artist_id
      and voter_id = auth.uid()
      and category = p_category
  ) then
    raise exception 'Voce ja votou nesta categoria';
  end if;

  insert into public.artist_votes (room_id, artist_id, voter_id, category)
  values (p_room_id, p_artist_id, auth.uid(), p_category);

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.get_artist_votes(uuid, uuid) from public, anon;
grant execute on function public.get_artist_votes(uuid, uuid) to authenticated;
revoke all on function public.cast_artist_vote(uuid, uuid, text) from public, anon;
grant execute on function public.cast_artist_vote(uuid, uuid, text) to authenticated;

create or replace function public.finish_battle(
  p_battle_id uuid,
  p_winner_id uuid default null
) returns public.battles
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
  if p_winner_id is not null then
    raise exception 'O vencedor e definido exclusivamente pelos votos';
  end if;

  select * into v_battle
  from public.battles
  where id = p_battle_id
    and status = 'voting'
    and auth.uid() in (challenger_artist_id, opponent_artist_id)
  for update;

  if not found then
    raise exception 'Batalha indisponivel para encerramento';
  end if;

  if v_battle.voting_started_at is null
     or now() < v_battle.voting_started_at + interval '30 seconds' then
    raise exception 'A votacao precisa ficar aberta por pelo menos 30 segundos';
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
        v_battle.id, v_battle.requester_id, null,
        v_battle.bounty_value, 0, v_battle.bounty_value, 'refunded'
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
        v_battle.id, v_battle.requester_id, v_winner,
        v_battle.bounty_value, v_fee, v_net, 'paid'
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

revoke all on function public.finish_battle(uuid, uuid) from public, anon;
grant execute on function public.finish_battle(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
