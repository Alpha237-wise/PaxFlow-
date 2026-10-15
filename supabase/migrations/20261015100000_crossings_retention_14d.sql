-- Retention policy change (2026-10-15): crossings/passengers now purge
-- after 14 DAYS (was 24 hours since 20260910090000, 30 days before that).
-- known_people/known_crew are untouched — they were never subject to this
-- purge and stay that way (§4.5/§15.1).
--
-- purge_expired_crossings() and its hourly pg_cron schedule need no change:
-- the query is `where expires_at < now()`, with no duration baked in — the
-- duration lives entirely in what expires_at gets set to at insert time
-- (the client sets it explicitly, src/lib/retention.ts; this default only
-- covers rows inserted without one). Existing rows keep the expires_at they
-- already have (24h rows still expire on their original schedule).
alter table public.crossings
  alter column expires_at set default (now() + interval '14 days');

comment on column public.crossings.expires_at is
  'Auto-purge deadline, default created_at + 14 days (24h from 2026-09-10, 14 days from 2026-10-15; 30 days before) — see purge_expired_crossings(). Existing rows keep whatever expires_at they already had; this only affects new inserts that do not set it explicitly.';

comment on function public.purge_expired_crossings() is
  'Deletes crossings (cascading to passengers) past their expires_at. Retention window is 14 days as of 2026-10-15 — enforced by what callers set expires_at to (see crossings.expires_at default and src/lib/retention.ts), not by this function.';
