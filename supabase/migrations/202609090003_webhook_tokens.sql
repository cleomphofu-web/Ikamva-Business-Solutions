alter table public.tenants add column if not exists webhook_token text;
comment on column public.tenants.webhook_token is 'SHA-256 hex digest of tenant webhook authorization secret';
create unique index if not exists tenants_webhook_token_idx on public.tenants (webhook_token) where webhook_token is not null;
