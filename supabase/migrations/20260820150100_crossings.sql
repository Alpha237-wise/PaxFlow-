-- Crossings. See docs/cahier-des-charges.md §12, §13.2, §15.1.

create table public.crossings (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid references public.vessels (id),
  created_by uuid not null references public.profiles (id),
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  crossing_date date not null,
  time_of_departure time,
  time_of_arrival time,
  port_of_origin text,
  destination text,
  vessel_name_override text,
  captain_on_board text,
  mechanic text,
  ab_name text,
  marine_hostess text,
  total_guests int,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crossings enable row level security;

create trigger crossings_set_updated_at
  before update on public.crossings
  for each row execute function public.set_updated_at();

create index crossings_created_by_idx on public.crossings (created_by);
-- Supports the daily purge job (§15.1, added in a later migration).
create index crossings_expires_at_idx on public.crossings (expires_at);

-- USER: full CRUD on own rows only.
create policy "crossings_select_own"
  on public.crossings for select
  using (created_by = auth.uid());

create policy "crossings_insert_own"
  on public.crossings for insert
  with check (created_by = auth.uid());

create policy "crossings_update_own"
  on public.crossings for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "crossings_delete_own"
  on public.crossings for delete
  using (created_by = auth.uid());

-- ADMIN: read-only supervision across all users.
create policy "crossings_select_admin"
  on public.crossings for select
  using (public.current_role() in ('admin', 'super_admin'));

-- SUPER_ADMIN: full read/write.
create policy "crossings_all_super_admin"
  on public.crossings for all
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');
