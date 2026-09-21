alter table public.ai_employees drop constraint if exists ai_employees_lifecycle_check;
alter table public.ai_employees add constraint ai_employees_lifecycle_check
  check (lifecycle_status in ('draft', 'configuring', 'testing', 'setup_required', 'ready', 'active', 'paused', 'suspended', 'needs_attention', 'blocked', 'archived'));
