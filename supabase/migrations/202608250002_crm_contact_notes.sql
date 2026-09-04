create table if not exists public.crm_contact_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  type text not null default 'note' check (type in ('call','email','meeting','note','follow_up')),
  content text not null,
  next_action text,
  next_action_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_contact_notes_contact_idx on public.crm_contact_notes(tenant_id, contact_id, created_at desc);
alter table public.crm_contact_notes enable row level security;
drop policy if exists crm_contact_notes_tenant_access on public.crm_contact_notes;
create policy crm_contact_notes_tenant_access on public.crm_contact_notes for all using (exists (select 1 from public.tenant_users tu where tu.tenant_id = crm_contact_notes.tenant_id and tu.user_id = auth.uid() and tu.status = 'active')) with check (exists (select 1 from public.tenant_users tu where tu.tenant_id = crm_contact_notes.tenant_id and tu.user_id = auth.uid() and tu.status = 'active'));
drop trigger if exists set_crm_contact_notes_updated_at on public.crm_contact_notes;
create trigger set_crm_contact_notes_updated_at before update on public.crm_contact_notes for each row execute function public.set_updated_at();
