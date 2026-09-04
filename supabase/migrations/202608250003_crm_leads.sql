create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null, email text not null, phone text, company text, source text, status text not null default 'new' check (status in ('new','contacted','qualified','proposal','converted','lost')),
  score integer not null default 50 check (score between 0 and 100), message text, service text, plan text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (tenant_id, email)
);
create index if not exists crm_leads_tenant_status_idx on public.crm_leads(tenant_id, status, updated_at desc);
alter table public.crm_leads enable row level security;
drop policy if exists crm_leads_tenant_access on public.crm_leads;
create policy crm_leads_tenant_access on public.crm_leads for all using (exists (select 1 from public.tenant_users tu where tu.tenant_id = crm_leads.tenant_id and tu.user_id = auth.uid() and tu.status = 'active')) with check (exists (select 1 from public.tenant_users tu where tu.tenant_id = crm_leads.tenant_id and tu.user_id = auth.uid() and tu.status = 'active'));
drop trigger if exists set_crm_leads_updated_at on public.crm_leads;
create trigger set_crm_leads_updated_at before update on public.crm_leads for each row execute function public.set_updated_at();
