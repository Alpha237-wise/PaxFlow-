-- Per-user writing colour for the generated manifest (§9.7, v1.20).
-- Purely cosmetic and per user (not per crossing); 'navy' is the colour the
-- manifest has always used, so every existing profile keeps its current look.
-- No new policy needed: profiles_update_own already lets a user update their
-- own row (it only pins `role`), and the role-change audit trigger only fires
-- when `role` itself changes.
alter table public.profiles
  add column manifest_ink text not null default 'navy'
  check (manifest_ink in ('navy', 'green', 'burgundy'));

comment on column public.profiles.manifest_ink is
  'Colour of the text injected on this user''s generated manifests: navy (default) | green | burgundy. Cosmetic only — no effect on classification or any business rule.';
