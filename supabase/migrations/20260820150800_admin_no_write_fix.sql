-- Fix: the "own row" policies only checked created_by = auth.uid(), which
-- let an `admin` (supervision-only per §13.2 — "aucune écriture") write
-- their own rows just like a `user`. Re-create them scoped to role = 'user'.
-- Also closes the case of a user promoted to admin after already owning
-- crossings: current_role() is re-evaluated per request, not fixed at
-- row-creation time.

drop policy "crossings_insert_own" on public.crossings;
drop policy "crossings_update_own" on public.crossings;
drop policy "crossings_delete_own" on public.crossings;

create policy "crossings_insert_own"
  on public.crossings for insert
  with check (created_by = auth.uid() and public.current_role() = 'user');

create policy "crossings_update_own"
  on public.crossings for update
  using (created_by = auth.uid() and public.current_role() = 'user')
  with check (created_by = auth.uid() and public.current_role() = 'user');

create policy "crossings_delete_own"
  on public.crossings for delete
  using (created_by = auth.uid() and public.current_role() = 'user');

drop policy "passengers_insert_own" on public.passengers;
drop policy "passengers_update_own" on public.passengers;
drop policy "passengers_delete_own" on public.passengers;

create policy "passengers_insert_own"
  on public.passengers for insert
  with check (
    public.current_role() = 'user'
    and exists (
      select 1 from public.crossings c
      where c.id = passengers.crossing_id and c.created_by = auth.uid()
    )
  );

create policy "passengers_update_own"
  on public.passengers for update
  using (
    public.current_role() = 'user'
    and exists (
      select 1 from public.crossings c
      where c.id = passengers.crossing_id and c.created_by = auth.uid()
    )
  )
  with check (
    public.current_role() = 'user'
    and exists (
      select 1 from public.crossings c
      where c.id = passengers.crossing_id and c.created_by = auth.uid()
    )
  );

create policy "passengers_delete_own"
  on public.passengers for delete
  using (
    public.current_role() = 'user'
    and exists (
      select 1 from public.crossings c
      where c.id = passengers.crossing_id and c.created_by = auth.uid()
    )
  );
