-- Artist votes are rendered live in room and TV views, so inserts must be
-- available through Postgres Changes just like chat and paid interactions.
alter table if exists public.artist_votes replica identity full;

do $$
begin
  if to_regclass('public.artist_votes') is not null then
    begin
      alter publication supabase_realtime add table public.artist_votes;
    exception
      when duplicate_object then
        null;
      when undefined_object then
        null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
