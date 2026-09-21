alter table public.tenant_integrations
  add column if not exists access_token_encrypted text,
  add column if not exists access_token_expires_at timestamptz,
  add column if not exists last_refreshed_at timestamptz;
