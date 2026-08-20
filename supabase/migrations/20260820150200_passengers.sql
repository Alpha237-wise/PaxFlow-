-- Passengers. See docs/cahier-des-charges.md §4.1, §12, §13.2.
--
-- Ownership is indirect (via crossings.created_by), so policies check
-- through an EXISTS on crossings. That subquery runs as the querying role
-- and is itself subject to crossings' RLS, which is fine: an owner can
-- already see their own crossing row via crossings_select_own.

create table public.passengers (
  id uuid primary key default gen_random_uuid(),
  crossing_id uuid not null references public.crossings (id) on delete cascade,
  seat_number int not null,
  name text not null,
  company_id_number text,
  department text,
  company_name text,
  classification_computed text not null check (classification_computed in ('TM', 'CC')),
  classification_final text not null check (classification_final in ('TM', 'CC')),
  classification_overridden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crossing_id, seat_number)
);

alter table public.passengers enable row level security;

create trigger passengers_set_updated_at
  before update on public.passengers
  for each row execute function public.set_updated_at();

create index passengers_crossing_id_idx on public.passengers (crossing_id);

create policy "passengers_select_own"
  on public.passengers for select
  using (
    exists (
      select 1 from public.crossings c
      where c.id = passengers.crossing_id and c.created_by = auth.uid()
    )
  );

create policy "passengers_insert_own"
  on public.passengers for insert
  with check (
    exists (
      select 1 from public.crossings c
      where c.id = passengers.crossing_id and c.created_by = auth.uid()
    )
  );

create policy "passengers_update_own"
  on public.passengers for update
  using (
    exists (
      select 1 from public.crossings c
      where c.id = passengers.crossing_id and c.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.crossings c
      where c.id = passengers.crossing_id and c.created_by = auth.uid()
    )
  );

create policy "passengers_delete_own"
  on public.passengers for delete
  using (
    exists (
      select 1 from public.crossings c
      where c.id = passengers.crossing_id and c.created_by = auth.uid()
    )
  );

create policy "passengers_select_admin"
  on public.passengers for select
  using (public.current_role() in ('admin', 'super_admin'));

create policy "passengers_all_super_admin"
  on public.passengers for all
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');
