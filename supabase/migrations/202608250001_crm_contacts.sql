create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  company text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create index if not exists crm_contacts_tenant_updated_idx
  on public.crm_contacts (tenant_id, updated_at desc);

alter table public.crm_contacts enable row level security;

drop policy if exists crm_contacts_tenant_isolation on public.crm_contacts;
create policy crm_contacts_tenant_isolation on public.crm_contacts
  for all using (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = crm_contacts.tenant_id
        and tu.user_id = auth.uid()
        and tu.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = crm_contacts.tenant_id
        and tu.user_id = auth.uid()
        and tu.status = 'active'
    )
  );

drop trigger if exists crm_contacts_set_updated_at on public.crm_contacts;
create trigger crm_contacts_set_updated_at
  before update on public.crm_contacts
  for each row execute function public.set_updated_at();
