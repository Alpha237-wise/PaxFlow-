-- Remaining §14 audit events (§21 step 16): crossing.create/update,
-- passenger.update (with classification_overridden tracked explicitly),
-- and data.delete on crossings. role.change and vessel.status_change were
-- already added in the previous migration (§21 step 15).
--
-- Deliberately NOT logging every cascaded passenger delete: the nightly
-- purge job (§15.1) deletes crossings in bulk, and each one cascades to
-- its passengers — logging every cascaded row would flood audit_log
-- (which has no retention policy of its own) without adding information
-- beyond "this crossing was deleted". pg_trigger_depth() distinguishes a
-- direct passenger delete (e.g. the "Remove" button on a seat) from one
-- triggered by the parent crossing's cascade, so only the former is
-- logged as its own data.delete entry.

create or replace function public.audit_crossing_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
  values (
    auth.uid(),
    'crossing.create',
    'crossings',
    new.id,
    jsonb_build_object('vessel_id', new.vessel_id, 'crossing_date', new.crossing_date)
  );
  return new;
end;
$$;

create trigger crossings_audit_create
  after insert on public.crossings
  for each row execute function public.audit_crossing_create();

create or replace function public.audit_crossing_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new is distinct from old then
    insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
    values (
      auth.uid(),
      'crossing.update',
      'crossings',
      new.id,
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger crossings_audit_update
  after update on public.crossings
  for each row execute function public.audit_crossing_update();

create or replace function public.audit_crossing_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger crossings_audit_delete
  after delete on public.crossings
  for each row execute function public.audit_crossing_delete();

create or replace function public.audit_passenger_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new is distinct from old then
    insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
    values (
      auth.uid(),
      'passenger.update',
      'passengers',
      new.id,
      jsonb_build_object(
        'crossing_id', new.crossing_id,
        'seat_number', new.seat_number,
        'classification_computed', new.classification_computed,
        'classification_final_old', old.classification_final,
        'classification_final_new', new.classification_final,
        'classification_overridden_old', old.classification_overridden,
        'classification_overridden_new', new.classification_overridden
      )
    );
  end if;
  return new;
end;
$$;

create trigger passengers_audit_update
  after update on public.passengers
  for each row execute function public.audit_passenger_update();

create or replace function public.audit_passenger_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 then
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

create trigger passengers_audit_delete
  after delete on public.passengers
  for each row execute function public.audit_passenger_delete();
