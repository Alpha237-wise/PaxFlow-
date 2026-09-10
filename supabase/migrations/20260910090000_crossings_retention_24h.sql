-- Retention policy change (2026-09-10): crossings/passengers now purge
-- after 24 HOURS, not 30 days. known_people/known_crew are untouched —
-- they were never subject to this purge and stay that way (§4.5/§15.1).
--
-- purge_expired_crossings()/its pg_cron schedule (20260820160000) need no
-- change: the query is `where expires_at < now()`, with no duration baked
-- in — the duration lives entirely in what expires_at gets set to at
-- insert time. Only the default (for any row inserted without an explicit
-- value) is a database-level concern; comment updated for clarity.
alter table public.crossings
  alter column expires_at set default (now() + interval '24 hours');

comment on column public.crossings.expires_at is
  'Auto-purge deadline, default created_at + 24h (changed from 30 days on 2026-09-10) — see purge_expired_crossings(). Existing rows keep whatever expires_at they already had; this only affects new inserts that do not set it explicitly.';

comment on function public.purge_expired_crossings() is
  'Deletes crossings (cascading to passengers) past their expires_at. Retention window is 24h as of 2026-09-10 (was 30 days) — enforced by what callers set expires_at to (see crossings.expires_at default and new-crossing-form.tsx), not by this function.';
