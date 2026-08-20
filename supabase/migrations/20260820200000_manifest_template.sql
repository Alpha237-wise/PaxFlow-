-- Shared manifest template (photo/PDF of the blank paper form) — new
-- architecture replacing the coded HTML template: overlay data onto a real
-- photo of the paper instead of redrawing its layout in code. One global
-- row/file, shared across all accounts, not duplicated per user.

insert into storage.buckets (id, name, public)
values ('manifest-template', 'manifest-template', false)
on conflict (id) do nothing;

create table public.manifest_template (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manifest_template enable row level security;

create trigger manifest_template_set_updated_at
  before update on public.manifest_template
  for each row execute function public.set_updated_at();

grant select on public.manifest_template to authenticated;
grant insert, update on public.manifest_template to authenticated;

-- Every authenticated user needs to read this to generate a manifest;
-- only super_admin can upload/replace it (§13.2-style admin-only write).
create policy "manifest_template_select_authenticated"
  on public.manifest_template for select
  to authenticated
  using (true);

create policy "manifest_template_write_super_admin"
  on public.manifest_template for all
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- Storage bucket policies mirror the table policies.
create policy "manifest_template_storage_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'manifest-template');

create policy "manifest_template_storage_write_super_admin"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'manifest-template' and public.current_role() = 'super_admin')
  with check (bucket_id = 'manifest-template' and public.current_role() = 'super_admin');
