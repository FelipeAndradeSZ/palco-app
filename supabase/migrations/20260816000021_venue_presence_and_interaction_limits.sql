-- Venues are first-class room participants and financial interactions must be
-- validated by the database, not only by browser controls.

alter table public.room_participants
  drop constraint if exists room_participants_role_check;

alter table public.room_participants
  add constraint room_participants_role_check
  check (role::text in ('listener', 'artist', 'venue'));

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

  new.song_title := trim(new.song_title);
  if length(new.song_title) < 1 or length(new.song_title) > 200 then
    raise exception 'A musica deve ter entre 1 e 200 caracteres';
  end if;

  new.dedication := nullif(trim(new.dedication), '');
  if length(coalesce(new.dedication, '')) > 200 then
    raise exception 'A dedicatoria deve ter no maximo 200 caracteres';
  end if;

  if new.bounty_value is null
     or new.bounty_value < 5
     or new.bounty_value > 500
     or new.bounty_value <> round(new.bounty_value, 2) then
    raise exception 'Valor do pedido deve ficar entre R$ 5,00 e R$ 500,00';
  end if;

  if new.target_artist_id is not null
     and not public.is_artist_stream_fresh(new.room_id, new.target_artist_id) then
    raise exception 'O artista escolhido nao esta ao vivo nesta sala';
  end if;

  new.status := 'pending';
  new.accepted_by := null;
  new.accepted_at := null;
  new.transaction_id := null;
  new.request_source := 'app';
  new.guest_name := null;

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

  if not public.is_artist_stream_fresh(v_request.room_id, auth.uid()) then
    raise exception 'Entre ao vivo nesta sala antes de aceitar pedidos';
  end if;

  update public.song_requests
    set status = 'accepted',
        accepted_by = auth.uid(),
        accepted_at = now()
    where id = p_request_id;
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

  if tip_amount is null
     or tip_amount < 5
     or tip_amount > 500
     or tip_amount <> round(tip_amount, 2) then
    raise exception 'Valor da gorjeta deve ficar entre R$ 5,00 e R$ 500,00';
  end if;

  tip_message := nullif(trim(tip_message), '');
  if length(coalesce(tip_message, '')) > 200 then
    raise exception 'A mensagem da gorjeta deve ter no maximo 200 caracteres';
  end if;

  if not public.is_artist_stream_fresh(target_room_id, target_artist_id) then
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
    jsonb_build_object('message', tip_message)
  ) returning id into v_transaction_id;

  insert into public.artist_interactions (
    room_id, artist_id, sender_id, interaction_type, amount, message, metadata
  ) values (
    target_room_id,
    target_artist_id,
    auth.uid(),
    'tip',
    tip_amount,
    tip_message,
    jsonb_build_object(
      'artist_share', v_artist_amount,
      'platform_fee', v_platform_fee,
      'transaction_id', v_transaction_id
    )
  ) returning * into v_interaction;

  return v_interaction;
end;
$$;

notify pgrst, 'reload schema';
