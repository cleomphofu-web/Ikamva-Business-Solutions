alter table public.tenants add column if not exists webhook_token text;
create unique index if not exists tenants_webhook_token_idx on public.tenants (webhook_token) where webhook_token is not null;
