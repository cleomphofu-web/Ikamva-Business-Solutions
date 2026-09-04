create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  email text not null,
  full_name text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'client')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, email)
);

create table if not exists public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tenant_user_id uuid references public.tenant_users(id) on delete set null,
  client_email text not null,
  company_name text,
  monthly_task_limit integer not null default 0 check (monthly_task_limit >= 0),
  tasks_used_this_month integer not null default 0 check (tasks_used_this_month >= 0),
  billing_cycle_start date not null,
  billing_cycle_end date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, client_email),
  check (billing_cycle_end >= billing_cycle_start),
  check (tasks_used_this_month <= monthly_task_limit)
);

create table if not exists public.client_sops (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_profile_id uuid references public.client_profiles(id) on delete cascade,
  name text not null,
  task_type text not null,
  version integer not null default 1 check (version > 0),
  active boolean not null default false,
  system_prompt text not null,
  validation_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  model_provider text,
  model_name text,
  model_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, task_type, version)
);

create unique index if not exists client_sops_one_active_per_task_type
on public.client_sops (tenant_id, task_type)
where active;

create table if not exists public.task_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_profile_id uuid references public.client_profiles(id) on delete set null,
  sop_id uuid references public.client_sops(id) on delete set null,
  task_type text not null,
  payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (
    status in (
      'pending',
      'validating',
      'waiting_quota',
      'processing',
      'awaiting_human',
      'completed',
      'failed',
      'cancelled',
      'quota_exceeded'
    )
  ),
  priority integer not null default 100 check (priority >= 0),
  idempotency_key text not null,
  retry_count integer not null default 0 check (retry_count >= 0),
  locked_at timestamptz,
  locked_by text,
  scheduled_for timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  unique (tenant_id, idempotency_key)
);

create index if not exists task_queue_claim_idx
on public.task_queue (status, scheduled_for, priority, created_at)
where status in ('pending', 'waiting_quota');

create index if not exists task_queue_tenant_status_idx
on public.task_queue (tenant_id, status, created_at desc);

create table if not exists public.task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_queue(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  from_status text,
  to_status text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists task_logs_task_created_idx
on public.task_logs (task_id, created_at);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_tenants_updated_at on public.tenants;
create trigger set_tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

drop trigger if exists set_tenant_users_updated_at on public.tenant_users;
create trigger set_tenant_users_updated_at
before update on public.tenant_users
for each row execute function public.set_updated_at();

drop trigger if exists set_client_profiles_updated_at on public.client_profiles;
create trigger set_client_profiles_updated_at
before update on public.client_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_client_sops_updated_at on public.client_sops;
create trigger set_client_sops_updated_at
before update on public.client_sops
for each row execute function public.set_updated_at();

drop trigger if exists set_task_queue_updated_at on public.task_queue;
create trigger set_task_queue_updated_at
before update on public.task_queue
for each row execute function public.set_updated_at();

create or replace function public.log_task_status_transition()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_logs (task_id, tenant_id, from_status, to_status, message, metadata, created_by)
    values (new.id, new.tenant_id, null, new.status, 'Task created', '{}'::jsonb, 'system');
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.task_logs (task_id, tenant_id, from_status, to_status, message, metadata, created_by)
    values (
      new.id,
      new.tenant_id,
      old.status,
      new.status,
      'Task status changed',
      jsonb_build_object('retry_count', new.retry_count, 'locked_by', new.locked_by),
      coalesce(new.locked_by, 'system')
    );
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists task_queue_status_log on public.task_queue;
create trigger task_queue_status_log
after insert or update of status on public.task_queue
for each row execute function public.log_task_status_transition();

create or replace function public.prevent_task_log_mutation()
returns trigger as $$
begin
  raise exception 'task_logs are immutable';
end;
$$ language plpgsql;

drop trigger if exists task_logs_prevent_update on public.task_logs;
create trigger task_logs_prevent_update
before update on public.task_logs
for each row execute function public.prevent_task_log_mutation();

drop trigger if exists task_logs_prevent_delete on public.task_logs;
create trigger task_logs_prevent_delete
before delete on public.task_logs
for each row execute function public.prevent_task_log_mutation();
