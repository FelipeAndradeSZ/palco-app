-- A performer can only participate in one live battle at a time. Serialize
-- creation per pair so concurrent requests cannot bypass the availability check.

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

  if p_challenger_artist_id is null
     or p_opponent_artist_id is null
     or p_challenger_artist_id = p_opponent_artist_id then
    raise exception 'Escolha dois artistas diferentes para a batalha';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(least(p_challenger_artist_id::text, p_opponent_artist_id::text), 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(greatest(p_challenger_artist_id::text, p_opponent_artist_id::text), 0)
  );

  select role::text into v_role
  from public.profiles
  where id = auth.uid();

  v_source := case
    when auth.uid() = p_challenger_artist_id and v_role = 'artist' then 'artist'
    else 'listener'
  end;
  v_bounty := coalesce(p_bounty_value, 0);

  if nullif(trim(p_song_title), '') is null or char_length(trim(p_song_title)) > 200 then
    raise exception 'Informe uma musica de ate 200 caracteres para a batalha';
  end if;

  if v_bounty < 0
     or v_bounty > 500
     or v_bounty <> round(v_bounty, 2) then
    raise exception 'Valor da batalha deve ficar entre R$ 0,00 e R$ 500,00';
  end if;

  if v_source = 'listener' and v_bounty < 5 then
    raise exception 'Batalha pedida pelo publico deve ter valor minimo de R$ 5,00';
  end if;

  if not public.is_artist_stream_fresh(p_room_id, p_challenger_artist_id)
     or not public.is_artist_stream_fresh(p_room_id, p_opponent_artist_id) then
    raise exception 'Os dois artistas precisam estar ao vivo na sala';
  end if;

  if exists (
    select 1
    from public.battles
    where room_id = p_room_id
      and status in ('pending', 'active', 'voting')
      and (
        challenger_artist_id in (p_challenger_artist_id, p_opponent_artist_id)
        or opponent_artist_id in (p_challenger_artist_id, p_opponent_artist_id)
      )
  ) then
    raise exception 'Um dos artistas ja participa de outra batalha nesta sala';
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
  ) returning * into v_battle;

  return v_battle;
end;
$$;

revoke all on function public.create_battle(uuid, uuid, uuid, text, numeric) from public, anon;
grant execute on function public.create_battle(uuid, uuid, uuid, text, numeric) to authenticated;

notify pgrst, 'reload schema';
