-- Privacy fix (2026-10-15): the data.delete audit triggers for
-- known_people / known_crew copied the deleted person's NAME into
-- audit_log.metadata. audit_log is readable by super_admin and its metadata
-- is displayed on the Super Admin screen, so deleting a remembered person
-- handed that person's name — part of a user's strictly private "mémoire
-- intelligente" (§4.5/§13.2: never visible to admin/super_admin) — to a
-- super_admin. Found by scripts/test-data-isolation.mjs.
--
-- The deletion itself is still audited (who, when, which row id, which
-- table) — §14 asks for the event, not for a copy of the data. known_crew
-- keeps its non-personal `role` (captain/mechanic/ab/marine_hostess).

create or replace function public.audit_known_people_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'data.delete', 'known_people', old.id, null);
  return old;
end;
$$;

create or replace function public.audit_known_crew_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'data.delete', 'known_crew', old.id, jsonb_build_object('role', old.role));
  return old;
end;
$$;

-- Scrub names already written by the old triggers. Runs as the migration
-- owner (audit_log has no UPDATE grant for client roles, by design).
update public.audit_log
   set metadata = null
 where target_table = 'known_people'
   and metadata ? 'name';

update public.audit_log
   set metadata = metadata - 'name'
 where target_table = 'known_crew'
   and metadata ? 'name';
