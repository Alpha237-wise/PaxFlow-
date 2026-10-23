-- ARPM2 ("A2"): a boat with its own 45-seat paper manifest form (2026-10-22).
-- Not a "BIRD n": the name is free text everywhere (vessels.name is just
-- unique), only seat_layout_ref is constrained, so widen that check and add
-- the boat. The manifest image for the new form is seeded separately
-- (scripts/seed-manifest-template.mjs 45-seats).

alter table public.vessels drop constraint vessels_seat_layout_ref_check;
alter table public.vessels
  add constraint vessels_seat_layout_ref_check
  check (seat_layout_ref in ('51-seats', '50-seats', '45-seats'));

insert into public.vessels (name, total_seats, seat_layout_ref)
values ('ARPM2', 45, '45-seats')
on conflict (name) do nothing;
