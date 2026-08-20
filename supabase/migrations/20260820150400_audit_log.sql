-- Audit log. See docs/cahier-des-charges.md §14.
--
-- No insert/update/delete policy is defined for any client-facing role:
-- per §14 this table must never be writable by a direct client request.
-- It will be populated by security definer triggers added once the events
-- they cover exist (role changes, vessel status changes, etc. — §21 step 16).

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create index audit_log_created_at_idx on public.audit_log (created_at desc);

create policy "audit_log_select_super_admin"
  on public.audit_log for select
  using (public.current_role() = 'super_admin');
