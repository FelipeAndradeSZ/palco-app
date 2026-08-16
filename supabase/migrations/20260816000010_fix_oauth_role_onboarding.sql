-- OAuth providers do not send the PALCO role metadata. Keep those profiles in
-- onboarding until the user explicitly chooses listener, artist or venue.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested_role text;
  v_role text;
  v_has_explicit_role boolean;
begin
  v_requested_role := lower(nullif(trim(new.raw_user_meta_data ->> 'role'), ''));
  v_has_explicit_role := v_requested_role in ('listener', 'artist', 'venue');
  v_role := case when v_has_explicit_role then v_requested_role else 'listener' end;

  insert into public.profiles (id, name, role, avatar_url, onboarding_completed)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Usuario PALCO'
    ),
    v_role::public.user_role,
    new.raw_user_meta_data ->> 'avatar_url',
    v_has_explicit_role
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

update public.profiles p
   set onboarding_completed = false
  from auth.users u
 where u.id = p.id
   and p.role = 'listener'
   and p.onboarding_completed = true
   and nullif(trim(u.raw_user_meta_data ->> 'role'), '') is null
   and not exists (
     select 1 from public.artist_details ad where ad.profile_id = p.id
   )
   and not exists (
     select 1 from public.venue_profiles vp where vp.profile_id = p.id
   );

revoke all on function public.handle_new_user() from public, anon, authenticated;

notify pgrst, 'reload schema';
