-- AI Workforce platform persistence. All tenant-owned rows are accessed through
-- backend repositories; authenticated policies are read-only defense in depth.

create table if not exists public.ai_employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  role text not null,
  mission text not null,
  goals jsonb not null default '[]'::jsonb,
  status text not null default 'idle' check (status in ('idle', 'thinking', 'working', 'waiting', 'approval_required', 'paused', 'failed')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create table if not exists public.company_knowledge (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  logical_key text not null,
  title text not null,
  category text not null,
  source text not null,
  content text not null default '',
  embedding_reference text,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  author_id uuid,
  confidence numeric(4,3) not null default 1 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create unique index if not exists company_knowledge_active_key_unique
  on public.company_knowledge (tenant_id, logical_key) where active;
create table if not exists public.employee_working_memory (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid references public.ai_employees(id) on delete cascade, task_id uuid references public.task_queue(id) on delete cascade,
  memory_type text not null default 'working' check (memory_type = 'working'), content jsonb not null, expires_at timestamptz,
  created_at timestamptz not null default now(), created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table if not exists public.employee_short_term_memory (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid references public.ai_employees(id) on delete cascade, task_id uuid references public.task_queue(id) on delete cascade,
  memory_type text not null default 'short_term' check (memory_type = 'short_term'), content jsonb not null, expires_at timestamptz,
  created_at timestamptz not null default now(), created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table if not exists public.company_long_term_memory (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid references public.ai_employees(id) on delete set null, task_id uuid references public.task_queue(id) on delete set null,
  memory_type text not null default 'long_term' check (memory_type = 'long_term'), content jsonb not null, expires_at timestamptz,
  created_at timestamptz not null default now(), created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table if not exists public.tenant_integrations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null, display_name text not null, status text not null default 'pending' check (status in ('pending', 'connected', 'disabled', 'failed')),
  credential_reference text, scopes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table if not exists public.approval_queue (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  task_id uuid not null references public.task_queue(id) on delete cascade, employee_id uuid references public.ai_employees(id) on delete set null,
  action text not null, reasoning_summary text not null default '', status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid, reviewed_by uuid, review_note text, reviewed_at timestamptz,
  created_at timestamptz not null default now(), created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table if not exists public.employee_task_plans (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  task_id uuid not null references public.task_queue(id) on delete cascade, employee_id uuid not null references public.ai_employees(id) on delete cascade,
  goal text not null, subtasks jsonb not null default '[]'::jsonb, required_tools jsonb not null default '[]'::jsonb,
  required_approvals jsonb not null default '[]'::jsonb, dependencies jsonb not null default '[]'::jsonb,
  confidence_score numeric(4,3) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  estimated_duration_seconds integer check (estimated_duration_seconds is null or estimated_duration_seconds >= 0),
  status text not null default 'planned' check (status in ('planned', 'executing', 'completed', 'failed')),
  planned_at timestamptz not null default now(), created_at timestamptz not null default now(), created_date timestamptz not null default now(), updated_date timestamptz not null default now(),
  unique (task_id)
);
create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null, aggregate_type text not null, aggregate_id uuid not null, payload jsonb not null default '{}'::jsonb,
  actor_id uuid, status text not null default 'pending' check (status in ('pending', 'published', 'failed')), occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(), created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table if not exists public.employee_activity_logs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid references public.ai_employees(id) on delete set null, task_id uuid references public.task_queue(id) on delete set null,
  action text not null, tool_name text, duration_ms integer check (duration_ms is null or duration_ms >= 0), result jsonb, error jsonb,
  token_usage jsonb, estimated_cost numeric(12,6), metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(), created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create index if not exists ai_employees_tenant_idx on public.ai_employees (tenant_id, status);
create index if not exists company_knowledge_tenant_idx on public.company_knowledge (tenant_id, active, updated_at desc);
create index if not exists approval_queue_tenant_idx on public.approval_queue (tenant_id, status, created_at desc);
create index if not exists employee_task_plans_tenant_idx on public.employee_task_plans (tenant_id, task_id);
create index if not exists domain_events_pending_idx on public.domain_events (tenant_id, status, occurred_at);
create index if not exists employee_activity_tenant_idx on public.employee_activity_logs (tenant_id, occurred_at desc);
-- Use one valid policy per operation per table: reads are membership-scoped and all browser-side
-- writes are denied. Service-role backend repositories bypass RLS as intended.
do $$
declare table_name text;
begin
  foreach table_name in array array['ai_employees', 'company_knowledge', 'employee_working_memory', 'employee_short_term_memory', 'company_long_term_memory', 'tenant_integrations', 'approval_queue', 'employee_task_plans', 'domain_events', 'employee_activity_logs']
  loop
    execute format('alter table public.%I enable row level security', table_name);

    -- Authenticated users may read their tenant's rows (defense-in-depth; backend uses service-role)
    execute format(
      'create policy %I on public.%I for select to authenticated using (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()))',
      table_name || '_select_tenant', table_name
    );

    -- Block authenticated-user inserts
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (false)',
      table_name || '_no_insert', table_name
    );

    -- Block authenticated-user updates
    execute format(
      'create policy %I on public.%I for update to authenticated using (false) with check (false)',
      table_name || '_no_update', table_name
    );

    -- Block authenticated-user deletes
    execute format(
      'create policy %I on public.%I for delete to authenticated using (false)',
      table_name || '_no_delete', table_name
    );
  end loop;
end $$;
