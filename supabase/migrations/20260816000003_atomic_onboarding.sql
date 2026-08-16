-- Complete OAuth onboarding atomically and prevent partial role changes.

create or replace function public.guard_profile_onboarding_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
     and coalesce(current_setting('palco.onboarding_role_change', true), '') <> 'allowed'
     and (
       new.role is distinct from old.role
       or new.onboarding_completed is distinct from old.onboarding_completed
     ) then
    raise exception 'Use o fluxo de cadastro do PALCO para escolher o tipo de conta';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_onboarding_fields on public.profiles;
create trigger trg_guard_profile_onboarding_fields
before update on public.profiles
for each row execute function public.guard_profile_onboarding_fields();

create or replace function public.complete_profile_onboarding(
  p_role text,
  p_main_genre text default null
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_role not in ('listener', 'artist', 'venue') then
    raise exception 'Tipo de conta invalido';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Perfil nao encontrado';
  end if;

  if v_profile.onboarding_completed then
    if v_profile.role::text = p_role then
      return v_profile;
    end if;
    raise exception 'O cadastro desta conta ja foi concluido';
  end if;

  if p_role = 'artist' and nullif(trim(p_main_genre), '') is null then
    raise exception 'Selecione o genero musical principal';
  end if;

  perform set_config('palco.onboarding_role_change', 'allowed', true);

  update public.profiles
     set role = p_role::public.user_role,
         onboarding_completed = true
   where id = auth.uid()
   returning * into v_profile;

  if p_role = 'artist' then
    insert into public.artist_details (
      profile_id,
      main_genre,
      quality_tier,
      available_for_booking
    ) values (
      auth.uid(),
      trim(p_main_genre),
      'bronze',
      true
    )
    on conflict (profile_id) do update
      set main_genre = excluded.main_genre,
          available_for_booking = true;
  elsif p_role = 'venue' then
    insert into public.venue_profiles (profile_id)
    values (auth.uid())
    on conflict (profile_id) do nothing;
  end if;

  return v_profile;
end;
$$;

revoke all on function public.complete_profile_onboarding(text, text) from public, anon;
grant execute on function public.complete_profile_onboarding(text, text) to authenticated;
revoke all on function public.guard_profile_onboarding_fields() from public, anon, authenticated;

notify pgrst, 'reload schema';
