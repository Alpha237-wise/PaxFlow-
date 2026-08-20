-- Mémoire intelligente : strictement privée par utilisateur, jamais visible
-- par admin/super_admin dans l'UI standard (§4.5, §13.2), pas de purge
-- automatique (§15.1) — cette table n'a donc pas d'expires_at.

create table public.known_people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  name text not null,
  company_id_number text,
  department text,
  company_name text,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.known_people enable row level security;

create index known_people_owner_id_idx on public.known_people (owner_id);

create policy "known_people_all_own"
  on public.known_people for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table public.known_crew (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  role text not null check (role in ('captain', 'mechanic', 'ab', 'marine_hostess')),
  name text not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.known_crew enable row level security;

create index known_crew_owner_id_idx on public.known_crew (owner_id);

create policy "known_crew_all_own"
  on public.known_crew for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
