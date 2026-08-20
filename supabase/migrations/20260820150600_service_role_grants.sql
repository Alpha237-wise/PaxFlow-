-- service_role should bypass RLS, but PostgREST still enforces base table
-- privileges first — this project's schema doesn't have the usual Supabase
-- default privileges wired up for service_role, so grant explicitly.
grant all on public.profiles to service_role;
grant all on public.vessels to service_role;
grant all on public.crossings to service_role;
grant all on public.passengers to service_role;
grant all on public.known_people to service_role;
grant all on public.known_crew to service_role;
grant all on public.audit_log to service_role;
