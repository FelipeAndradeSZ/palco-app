-- PostgREST reports a successful DELETE even when RLS hides every row. Allow
-- users to explicitly leave their own room presence so counters stay exact.

drop policy if exists "Room participants leave own presence" on public.room_participants;
create policy "Room participants leave own presence"
  on public.room_participants for delete
  using (auth.uid() = profile_id);

notify pgrst, 'reload schema';
