alter table public.ai_employees
  add column if not exists autonomy_mode text not null default 'approve';
alter table public.ai_employees
  drop constraint if exists ai_employees_autonomy_mode_check;
alter table public.ai_employees
  add constraint ai_employees_autonomy_mode_check
  check (autonomy_mode in ('observe', 'draft', 'approve', 'controlled', 'autonomous'));
