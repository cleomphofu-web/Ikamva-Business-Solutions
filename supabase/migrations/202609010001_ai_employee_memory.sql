create table public.ai_employee_memory (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id),
  employee_id   uuid not null references public.ai_employees(id),
  task_id       uuid references public.task_queue(id),
  memory_type   text not null,
  content       text not null,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

alter table public.ai_employee_memory enable row level security;

create policy ai_employee_memory_tenant_access on public.ai_employee_memory
  for all using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'platform_admin')
    or exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = ai_employee_memory.tenant_id
      and tu.user_id = auth.uid()
      and tu.status = 'active'
    )
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'platform_admin')
    or exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = ai_employee_memory.tenant_id
      and tu.user_id = auth.uid()
      and tu.status = 'active'
    )
  );

create index ai_employee_memory_employee_idx
  on public.ai_employee_memory(employee_id, created_at desc);
