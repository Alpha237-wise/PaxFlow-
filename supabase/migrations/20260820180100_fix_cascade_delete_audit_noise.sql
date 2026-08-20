-- Fix: pg_trigger_depth() does NOT distinguish a direct passenger delete
-- from one cascaded by its parent crossing's deletion (verified empirically
-- via scripts/debug-audit-triggers.mjs — a cascade-deleted passenger still
-- got its own data.delete row under the previous migration's logic). Use a
-- transaction-local flag instead: the crossing's delete trigger sets it
-- BEFORE the cascade runs, so the passenger trigger can see it.

create or replace function public.audit_crossing_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('paxflow.cascading_delete', 'true', true);
  insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
  values (
    auth.uid(),
    'data.delete',
    'crossings',
    old.id,
    jsonb_build_object('crossing_date', old.crossing_date, 'vessel_id', old.vessel_id)
  );
  return old;
end;
$$;

drop trigger crossings_audit_delete on public.crossings;
create trigger crossings_audit_delete
  before delete on public.crossings
  for each row execute function public.audit_crossing_delete();

create or replace function public.audit_passenger_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('paxflow.cascading_delete', true), 'false') <> 'true' then
    insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
    values (
      auth.uid(),
      'data.delete',
      'passengers',
      old.id,
      jsonb_build_object('crossing_id', old.crossing_id, 'seat_number', old.seat_number, 'name', old.name)
    );
  end if;
  return old;
end;
$$;
