-- A network retry must never charge a listener twice for the same action.

alter table public.song_requests
  add column if not exists client_request_id uuid;

alter table public.artist_interactions
  add column if not exists client_request_id uuid;

create unique index if not exists song_requests_requester_operation_uidx
  on public.song_requests (requester_id, client_request_id)
  where client_request_id is not null;

create unique index if not exists artist_interactions_sender_operation_uidx
  on public.artist_interactions (sender_id, client_request_id)
  where client_request_id is not null;

create or replace function public.send_artist_tip_idempotent(
  p_room_id uuid,
  p_artist_id uuid,
  p_amount numeric,
  p_message text,
  p_client_request_id uuid
)
returns jsonb
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

  if p_client_request_id is null then
    raise exception 'Identificador da operacao ausente';
  end if;

  if p_artist_id is null or p_artist_id = auth.uid() then
    raise exception 'Artista de destino invalido';
  end if;

  if p_amount is null
     or p_amount < 5
     or p_amount > 500
     or p_amount <> round(p_amount, 2) then
    raise exception 'Valor da gorjeta deve ficar entre R$ 5,00 e R$ 500,00';
  end if;

  p_message := nullif(trim(p_message), '');
  if length(coalesce(p_message, '')) > 200 then
    raise exception 'A mensagem da gorjeta deve ter no maximo 200 caracteres';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text || ':' || p_client_request_id::text, 0)
  );

  select * into v_interaction
  from public.artist_interactions
  where sender_id = auth.uid()
    and client_request_id = p_client_request_id;

  if found then
    if v_interaction.interaction_type <> 'tip'
       or v_interaction.room_id is distinct from p_room_id
       or v_interaction.artist_id is distinct from p_artist_id
       or v_interaction.amount is distinct from p_amount
       or v_interaction.message is distinct from p_message then
      raise exception 'Identificador reutilizado com dados diferentes';
    end if;

    return jsonb_build_object(
      'interaction', to_jsonb(v_interaction),
      'created', false
    );
  end if;

  if not public.is_artist_stream_fresh(p_room_id, p_artist_id) then
    raise exception 'O artista nao esta ao vivo nesta sala';
  end if;

  insert into public.wallets (profile_id, balance)
  values (p_artist_id, 0)
  on conflict (profile_id) do nothing;

  update public.wallets
    set balance = balance - p_amount
    where profile_id = auth.uid()
      and balance >= p_amount;

  if not found then
    raise exception 'Saldo insuficiente';
  end if;

  v_platform_fee := round(p_amount * 0.10, 2);
  v_artist_amount := p_amount - v_platform_fee;

  update public.wallets
    set balance = balance + v_artist_amount
    where profile_id = p_artist_id;

  insert into public.transactions (
    sender_id, receiver_id, amount, platform_fee, type, status, metadata
  ) values (
    auth.uid(),
    p_artist_id,
    p_amount,
    v_platform_fee,
    'tip'::public.transaction_type,
    'completed'::public.transaction_status,
    jsonb_build_object(
      'message', p_message,
      'client_request_id', p_client_request_id
    )
  ) returning id into v_transaction_id;

  insert into public.artist_interactions (
    room_id,
    artist_id,
    sender_id,
    interaction_type,
    amount,
    message,
    metadata,
    client_request_id
  ) values (
    p_room_id,
    p_artist_id,
    auth.uid(),
    'tip',
    p_amount,
    p_message,
    jsonb_build_object(
      'artist_share', v_artist_amount,
      'platform_fee', v_platform_fee,
      'transaction_id', v_transaction_id
    ),
    p_client_request_id
  ) returning * into v_interaction;

  return jsonb_build_object(
    'interaction', to_jsonb(v_interaction),
    'created', true
  );
end;
$$;

revoke all on function public.send_artist_tip_idempotent(uuid, uuid, numeric, text, uuid)
  from public, anon;
grant execute on function public.send_artist_tip_idempotent(uuid, uuid, numeric, text, uuid)
  to authenticated;

notify pgrst, 'reload schema';
