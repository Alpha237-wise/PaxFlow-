-- Vessels (the fleet of "BIRD" catamarans). See docs/cahier-des-charges.md §4.4, §5.1, §12.
--
-- No `operational_seats` column: §4.4 confirms no capacity distinction is
-- enforced in V1 (decision validated 2026-08-20).

create table public.vessels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  total_seats int not null,
  status text not null default 'active' check (status in ('active', 'out_of_service')),
  seat_layout_ref text not null check (seat_layout_ref in ('51-seats', '50-seats')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vessels enable row level security;

-- Vessels are reference data: any authenticated user can read the fleet list
-- (needed to pick a BIRD, §11.2). Writes are restricted to super_admin (§13.2)
-- via a policy added once the role-check helper exists (see next migration).
create policy "vessels_select_authenticated"
  on public.vessels for select
  to authenticated
  using (true);

create trigger vessels_set_updated_at
  before update on public.vessels
  for each row execute function public.set_updated_at();

-- Seed the 10 BIRD vessels (§4.4/§5.1: BIRD 1-8 = 51 seats, BIRD 9-10 = 50 seats).
insert into public.vessels (name, total_seats, seat_layout_ref)
select 'BIRD ' || n, case when n <= 8 then 51 else 50 end, case when n <= 8 then '51-seats' else '50-seats' end
from generate_series(1, 10) as n;
