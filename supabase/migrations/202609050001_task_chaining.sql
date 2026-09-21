-- Add parent/step tracking to task_queue for multi-step workflows.
alter table public.task_queue
  add column if not exists parent_task_id uuid references public.task_queue(id),
  add column if not exists step_index integer not null default 0,
  add column if not exists step_name text,
  add column if not exists chain_config jsonb;

create index if not exists task_queue_parent_idx
  on public.task_queue(parent_task_id)
  where parent_task_id is not null;
