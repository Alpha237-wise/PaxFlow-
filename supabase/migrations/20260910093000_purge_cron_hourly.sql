-- Retention window dropped to 24h (20260910090000) specifically to limit
-- stored volume/cost; a daily purge sweep against a 24h TTL could let a
-- crossing linger up to ~48h effective, defeating that goal. Tighten the
-- schedule to hourly — cron.schedule() with the same job name replaces
-- the existing job's schedule/command in place, no unschedule step
-- needed.
select cron.schedule(
  'purge-expired-crossings',
  '0 * * * *', -- hourly, on the hour (was daily at 03:00 UTC)
  $$ select public.purge_expired_crossings(); $$
);
