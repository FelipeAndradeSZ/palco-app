-- Hide room activity and private artist payout/contact data from anonymous scraping.

create or replace function public.can_access_room_activity(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_platform_admin()
    or exists (
      select 1
      from public.room_participants rp
      where rp.room_id = p_room_id
        and rp.profile_id = auth.uid()
        and rp.last_seen_at > now() - interval '90 seconds'
    )
    or public.is_artist_stream_fresh(p_room_id, auth.uid())
  );
$$;

create or replace function public.can_access_battle_activity(p_battle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.battles b
    where b.id = p_battle_id
      and (
        public.can_access_room_activity(b.room_id)
        or auth.uid() in (b.requester_id, b.challenger_artist_id, b.opponent_artist_id)
      )
  );
$$;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and tablename in (
        'room_participants',
        'song_requests',
        'artist_interactions',
        'chat_messages',
        'artist_votes',
        'battles',
        'battle_votes'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  end loop;
end;
$$;

create policy "Room participants read own presence"
  on public.room_participants for select
  using (auth.uid() = profile_id or public.is_platform_admin());

create policy "Room members read song requests"
  on public.song_requests for select
  using (
    auth.uid() is not null
    and (
      public.can_access_room_activity(room_id)
      or auth.uid() in (requester_id, target_artist_id, accepted_by)
    )
  );

create policy "Room members read artist interactions"
  on public.artist_interactions for select
  using (
    auth.uid() is not null
    and (
      public.can_access_room_activity(room_id)
      or auth.uid() in (sender_id, artist_id)
    )
  );

create policy "Room members read chat"
  on public.chat_messages for select
  using (
    auth.uid() is not null
    and (
      public.can_access_room_activity(room_id)
      or auth.uid() in (sender_id, artist_id)
    )
  );

create policy "Room members read artist votes"
  on public.artist_votes for select
  using (
    auth.uid() is not null
    and (
      public.can_access_room_activity(room_id)
      or auth.uid() in (voter_id, artist_id)
    )
  );

create policy "Room members read battles"
  on public.battles for select
  using (
    auth.uid() is not null
    and (
      public.can_access_room_activity(room_id)
      or auth.uid() in (requester_id, challenger_artist_id, opponent_artist_id)
    )
  );

create policy "Battle members read votes"
  on public.battle_votes for select
  using (
    auth.uid() is not null
    and (
      public.can_access_battle_activity(battle_id)
      or auth.uid() in (voter_id, artist_id)
    )
  );

revoke select on public.artist_details from anon, authenticated;
grant select (
  profile_id,
  quality_tier,
  main_genre,
  rating,
  total_hours_streamed,
  is_live,
  created_at,
  bio,
  repertoire,
  instagram_url,
  city,
  state,
  region,
  available_for_booking
) on public.artist_details to anon, authenticated;

create or replace function public.get_own_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) || jsonb_build_object(
    'artist_details', (
      select to_jsonb(ad)
      from public.artist_details ad
      where ad.profile_id = p.id
    )
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.get_battle_results(p_battle_id uuid)
returns table (
  artist_id uuid,
  category text,
  vote_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_access_battle_activity(p_battle_id) then
    raise exception 'Entre na sala para acompanhar esta batalha';
  end if;

  return query
    select bv.artist_id, bv.category, count(*)::bigint
    from public.battle_votes bv
    where bv.battle_id = p_battle_id
    group by bv.artist_id, bv.category;
end;
$$;

do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('credit_wallet_topup')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_function.signature);
    execute format('grant execute on function %s to service_role', v_function.signature);
  end loop;

  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'send_artist_tip',
        'process_song_request',
        'complete_song_request',
        'cancel_song_request',
        'request_withdrawal',
        'complete_manual_withdrawal',
        'reject_withdrawal',
        'create_battle',
        'accept_battle',
        'start_battle_voting',
        'vote_battle',
        'finish_battle',
        'cancel_battle',
        'set_artist_live_state',
        'heartbeat_artist_live',
        'complete_profile_onboarding',
        'get_battle_results',
        'get_artist_votes',
        'cast_artist_vote',
        'is_platform_admin',
        'curator_update_artist_tier',
        'get_own_profile',
        'can_access_room_activity',
        'can_access_battle_activity'
      )
  loop
    execute format('revoke execute on function %s from public, anon', v_function.signature);
    execute format('grant execute on function %s to authenticated', v_function.signature);
  end loop;

  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('simulate_approve_withdrawal', 'simulate_reject_withdrawal')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_function.signature);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
