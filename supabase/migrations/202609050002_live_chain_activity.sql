create table if not exists public.task_chains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  parent_task_id uuid not null unique,
  current_step_label text not null default 'Queued',
  current_step_index integer not null default 0,
  total_steps integer not null default 0,
  status text not null default 'pending',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.task_chains enable row level security;
alter publication supabase_realtime add table public.task_chains;
