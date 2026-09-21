-- Contract safety migration.
-- Backend service-role operations bypass RLS; browser clients receive only
-- authenticated, tenant-scoped read access.

create or replace function public.increment_tasks_used(profile_id uuid)
returns public.client_profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_profile public.client_profiles;
begin
  -- Atomically increment whichever quota columns are in use.
  -- pack_size / tasks_used_this_cycle: new task-pack schema (Section 4).
  -- monthly_task_limit / tasks_used_this_month: legacy monthly quota schema.
  -- The WHERE guard checks the applicable limit for the row so the RPC never
  -- silently no-ops for pack-schema profiles (which previously caused the
  -- fallback read-modify-write path to always fire, defeating atomicity).
  update public.client_profiles
  set tasks_used_this_month = tasks_used_this_month + 1,
      tasks_used_this_cycle = tasks_used_this_cycle + 1,
      updated_at = now()
  where id = profile_id
    and (
      -- pack schema: respect pack_size cap
      (pack_size is not null and tasks_used_this_cycle < pack_size)
      or
      -- legacy schema: respect monthly_task_limit cap
      (pack_size is null and tasks_used_this_month < monthly_task_limit)
    )
  returning * into updated_profile;

  return updated_profile;
end;
$$;


create index if not exists tenant_users_user_id_idx
on public.tenant_users (user_id);

create index if not exists client_profiles_tenant_user_id_idx
on public.client_profiles (tenant_user_id);

create index if not exists client_profiles_client_email_idx
on public.client_profiles (client_email);

alter table public.tenants enable row level security;
alter table public.tenant_users enable row level security;
alter table public.client_profiles enable row level security;
alter table public.client_sops enable row level security;
alter table public.task_queue enable row level security;
alter table public.task_logs enable row level security;

revoke all on table public.tenants, public.tenant_users, public.client_profiles,
  public.client_sops, public.task_queue, public.task_logs from anon, authenticated;
grant select on table public.tenants, public.tenant_users, public.client_profiles,
  public.client_sops, public.task_queue, public.task_logs to authenticated;

drop policy if exists "Users can read their tenant membership" on public.tenant_users;
create policy "Users can read their tenant membership"
  on public.tenant_users for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can read their tenant" on public.tenants;
create policy "Users can read their tenant"
  on public.tenants for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id = tenants.id and tu.user_id = (select auth.uid())
  ));

drop policy if exists "Users can read their client profile" on public.client_profiles;
create policy "Users can read their client profile"
  on public.client_profiles for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.id = client_profiles.tenant_user_id
      and tu.user_id = (select auth.uid())
  ));

drop policy if exists "Users can read tenant SOPs" on public.client_sops;
create policy "Users can read tenant SOPs"
  on public.client_sops for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id = client_sops.tenant_id
      and tu.user_id = (select auth.uid())
  ));

drop policy if exists "Users can read tenant tasks" on public.task_queue;
create policy "Users can read tenant tasks"
  on public.task_queue for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id = task_queue.tenant_id
      and tu.user_id = (select auth.uid())
  ));

drop policy if exists "Users can read tenant task logs" on public.task_logs;
create policy "Users can read tenant task logs"
  on public.task_logs for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id = task_logs.tenant_id
      and tu.user_id = (select auth.uid())
  ));
