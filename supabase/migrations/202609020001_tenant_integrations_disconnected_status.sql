alter table public.tenant_integrations
  drop constraint if exists tenant_integrations_status_check;

alter table public.tenant_integrations
  add constraint tenant_integrations_status_check
  check (status in ('pending', 'connected', 'disabled', 'failed', 'disconnected'));
