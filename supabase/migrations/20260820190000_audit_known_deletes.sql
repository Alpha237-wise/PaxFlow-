-- data.delete coverage for known_people/known_crew (§14 "quel que soit
-- l'objet"). No deletion pathway existed for these tables before the
-- manual delete/reset feature — adding the trigger now that one does,
-- same pattern as crossings/passengers (§21 step 16).

create or replace function public.audit_known_people_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'data.delete', 'known_people', old.id, jsonb_build_object('name', old.name));
  return old;
end;
$$;

create trigger known_people_audit_delete
  after delete on public.known_people
  for each row execute function public.audit_known_people_delete();

create or replace function public.audit_known_crew_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'data.delete', 'known_crew', old.id, jsonb_build_object('name', old.name, 'role', old.role));
  return old;
end;
$$;

create trigger known_crew_audit_delete
  after delete on public.known_crew
  for each row execute function public.audit_known_crew_delete();
