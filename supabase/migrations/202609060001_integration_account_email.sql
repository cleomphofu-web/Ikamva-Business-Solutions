alter table public.tenant_integrations
  add column if not exists account_email text;
