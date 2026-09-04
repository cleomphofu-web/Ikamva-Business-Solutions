-- Close the RLS gap left by 202608250004. Tenant members retain access to
-- their own account operations; platform admins retain controlled CRM access.
do $$
declare table_name text;
begin
  foreach table_name in array array['crm_invoices', 'crm_projects', 'crm_client_services']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_tenant_access', table_name);
    execute format('create policy %I on public.%I for all using ((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''platform_admin'') or exists (select 1 from public.tenant_users tu where tu.tenant_id = %I.tenant_id and tu.user_id = auth.uid() and tu.status = ''active'')) with check ((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''platform_admin'') or exists (select 1 from public.tenant_users tu where tu.tenant_id = %I.tenant_id and tu.user_id = auth.uid() and tu.status = ''active''))', table_name || '_tenant_access', table_name, table_name, table_name);
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;
