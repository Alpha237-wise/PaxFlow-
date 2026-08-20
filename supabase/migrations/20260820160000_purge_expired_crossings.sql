-- Purge automatique à 30 jours — docs/cahier-des-charges.md §15.1.
-- Only crossings/passengers (cascade); known_people/known_crew are never
-- touched by this job (§4.5/§4.7).

create extension if not exists pg_cron;

create or replace function public.purge_expired_crossings()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.crossings where expires_at < now();
$$;

select cron.schedule(
  'purge-expired-crossings',
  '0 3 * * *', -- daily at 03:00 UTC
  $$ select public.purge_expired_crossings(); $$
);
