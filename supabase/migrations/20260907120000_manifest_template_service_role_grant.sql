-- manifest_template (added 2026-08-20) was missing from the service_role
-- grants added in 20260820150600_service_role_grants.sql — same root cause
-- (schema doesn't have Supabase's usual default privilege wiring for
-- service_role), just an omission since this table came later.
grant all on public.manifest_template to service_role;
