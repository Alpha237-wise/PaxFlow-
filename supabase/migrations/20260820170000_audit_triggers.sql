-- Audit triggers for the two mutations the Super Admin screen introduces
-- (§21 step 15): role changes (§13.3 — "chaque changement de rôle génère
-- une entrée dans audit_log") and vessel status changes (§14). Using
-- triggers rather than app-layer inserts means every UPDATE path is
-- covered, not just this specific UI. The remaining audit events listed in
-- §14 (crossing.create/update, data.delete) are §21 step 16's job.
--
-- security definer: audit_log has no INSERT grant for `authenticated`
-- at all (§14/§21 step 3) — these functions run as their owner instead,
-- which is how they're allowed to write despite that.

create or replace function public.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
    values (
      auth.uid(),
      'role.change',
      'profiles',
      new.id,
      jsonb_build_object('old_role', old.role, 'new_role', new.role)
    );
  end if;
  return new;
end;
$$;

create trigger profiles_audit_role_change
  after update on public.profiles
  for each row execute function public.audit_role_change();

create or replace function public.audit_vessel_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
    values (
      auth.uid(),
      'vessel.status_change',
      'vessels',
      new.id,
      jsonb_build_object('old_status', old.status, 'new_status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger vessels_audit_status_change
  after update on public.vessels
  for each row execute function public.audit_vessel_status_change();
