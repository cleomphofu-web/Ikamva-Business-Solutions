create table if not exists public.tenant_usage_windows (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  window_start timestamptz not null,
  provider_calls integer not null default 0,
  provider_call_limit integer not null default 1000,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, window_start)
);
alter table public.tenant_usage_windows enable row level security;
create or replace function public.consume_tenant_provider_call(p_tenant_id uuid, p_limit integer default 1000)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_window timestamptz := date_trunc('minute', now()); v_calls integer;
begin
  insert into public.tenant_usage_windows(tenant_id, window_start, provider_call_limit)
  values (p_tenant_id, v_window, p_limit)
  on conflict (tenant_id, window_start) do nothing;
  update public.tenant_usage_windows set provider_calls = provider_calls + 1, updated_at = now()
  where tenant_id = p_tenant_id and window_start = v_window and provider_calls < provider_call_limit
  returning provider_calls into v_calls;
  return v_calls is not null;
end;
$$;
revoke all on function public.consume_tenant_provider_call(uuid, integer) from public;
