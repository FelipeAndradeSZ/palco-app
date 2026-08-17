-- Presence cleanup is database maintenance, not a public read side effect.
-- Run it internally once per minute and keep the maintenance functions private.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.maintain_palco_live_state()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_stale_room_presence();

  delete from public.webrtc_signals
  where created_at < now() - interval '10 minutes';
end;
$$;

revoke all on function public.expire_stale_room_presence() from public, anon, authenticated;
revoke all on function public.maintain_palco_live_state() from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'palco-maintain-live-state'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'palco-maintain-live-state',
    '* * * * *',
    'select public.maintain_palco_live_state();'
  );
end;
$$;

notify pgrst, 'reload schema';
