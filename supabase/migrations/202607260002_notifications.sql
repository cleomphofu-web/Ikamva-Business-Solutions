-- Notification persistence table
-- Provides durable storage for all notification attempts

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null,
  recipient text not null,
  provider text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (
    status in (
      'queued',
      'sending',
      'sent',
      'delivered',
      'failed',
      'retrying',
      'cancelled'
    )
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  provider_response jsonb,
  last_error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  last_attempt_at timestamptz,
  next_retry_at timestamptz
);
create index if not exists notifications_tenant_id_idx
  on public.notifications (tenant_id);
create index if not exists notifications_status_idx
  on public.notifications (status);
create index if not exists notifications_tenant_status_idx
  on public.notifications (tenant_id, status, created_at desc);
create index if not exists notifications_idempotency_idx
  on public.notifications (tenant_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists notifications_idempotency_unique
  on public.notifications (tenant_id, idempotency_key)
  where idempotency_key is not null;
-- Trigger to update updated_at timestamp
drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();
-- RLS policies
alter table public.notifications enable row level security;
-- Users can read notifications for their tenants
create policy notifications_select_tenant on public.notifications
  for select
  to authenticated
  using (tenant_id in (
    select tenant_id from public.tenant_users where user_id = auth.uid()
  ));
-- Block inserts from authenticated users
create policy notifications_no_insert on public.notifications
  for insert
  to authenticated
  with check (false);
-- Block updates from authenticated users
create policy notifications_no_update on public.notifications
  for update
  to authenticated
  using (false)
  with check (false);
-- Block deletes from authenticated users
create policy notifications_no_delete on public.notifications
  for delete
  to authenticated
  using (false);
-- Service role bypasses RLS - no policy needed;
