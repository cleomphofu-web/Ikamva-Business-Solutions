begin;

alter table public.ai_employee_memory
  add column if not exists thread_id text null;

alter table public.ai_employee_memory
  add column if not exists source text null;

alter table public.ai_employee_memory
  drop constraint if exists ai_employee_memory_source_check;

alter table public.ai_employee_memory
  add constraint ai_employee_memory_source_check
  check (source is null or source in ('chat', 'email'));

commit;
