create table if not exists public.artist_interactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  artist_id uuid references public.profiles(id) on delete set null,
  sender_id uuid references public.profiles(id) on delete set null,
  interaction_type text not null check (interaction_type in ('tip', 'vote', 'dedication')),
  amount numeric(10,2),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.artist_interactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'artist_interactions'
      and policyname = 'Anyone can read artist interactions'
  ) then
    create policy "Anyone can read artist interactions"
      on public.artist_interactions for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'artist_interactions'
      and policyname = 'Authenticated users can create artist interactions'
  ) then
    create policy "Authenticated users can create artist interactions"
      on public.artist_interactions for insert
      with check (auth.uid() = sender_id);
  end if;
end $$;

create or replace function public.send_artist_tip(
  target_room_id uuid,
  target_artist_id uuid,
  tip_amount numeric,
  tip_message text default null
) returns public.artist_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  created_interaction public.artist_interactions;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if target_artist_id is null then
    raise exception 'Escolha um artista para enviar a gorjeta';
  end if;

  if tip_amount < 5 or tip_amount > 500 then
    raise exception 'Valor de gorjeta inválido';
  end if;

  update public.wallets
    set balance = balance - tip_amount
    where profile_id = auth.uid()
      and balance >= tip_amount;

  if not found then
    raise exception 'Saldo insuficiente';
  end if;

  update public.wallets
    set balance = balance + (tip_amount * 0.90)
    where profile_id = target_artist_id;

  insert into public.artist_interactions (
    room_id,
    artist_id,
    sender_id,
    interaction_type,
    amount,
    message,
    metadata
  ) values (
    target_room_id,
    target_artist_id,
    auth.uid(),
    'tip',
    tip_amount,
    nullif(trim(tip_message), ''),
    jsonb_build_object('artist_share', tip_amount * 0.90, 'platform_fee', tip_amount * 0.10)
  )
  returning * into created_interaction;

  return created_interaction;
end;
$$;

grant execute on function public.send_artist_tip(uuid, uuid, numeric, text) to authenticated;
