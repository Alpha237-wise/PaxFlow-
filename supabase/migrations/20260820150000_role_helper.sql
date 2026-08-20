-- Recursion-safe role check for RLS policies. A plain subquery on
-- public.profiles inside another table's policy would re-trigger profiles'
-- own RLS for the querying role; wrapping it in a security definer function
-- (owned by the migration role, which bypasses RLS on the tables it owns)
-- avoids that. See docs/cahier-des-charges.md §13.2.
create function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Completes the vessels/profiles policies left pending at §21 step 1,
-- now that the helper exists.
create policy "vessels_all_super_admin"
  on public.vessels for all
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy "profiles_select_super_admin"
  on public.profiles for select
  using (public.current_role() = 'super_admin');

create policy "profiles_update_super_admin"
  on public.profiles for update
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');
