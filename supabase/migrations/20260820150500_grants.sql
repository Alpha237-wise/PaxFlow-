-- Base Postgres privileges for PostgREST. RLS policies alone are not
-- enough: without an explicit GRANT, PostgREST denies the request before
-- RLS is even evaluated. No table here grants anything to `anon` — every
-- table requires authentication (§13.1).

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.vessels to authenticated;
grant select, insert, update, delete on public.crossings to authenticated;
grant select, insert, update, delete on public.passengers to authenticated;
grant select, insert, update, delete on public.known_people to authenticated;
grant select, insert, update, delete on public.known_crew to authenticated;
-- audit_log: SELECT only — no insert/update/delete grant at all, so the
-- "never writable by a direct client request" rule (§14) holds even before
-- RLS is considered.
grant select on public.audit_log to authenticated;
