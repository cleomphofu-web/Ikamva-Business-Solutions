create or replace function public.enqueue_email_triage_task(
  p_tenant_id uuid, p_client_profile_id uuid, p_message_id text,
  p_payload jsonb, p_idempotency_key text
)
returns setof public.task_queue
language plpgsql security definer set search_path = public
as $$
begin
  if not pg_try_advisory_xact_lock(hashtext(p_message_id)) then return; end if;
  insert into public.task_queue (tenant_id, client_profile_id, task_type, payload, idempotency_key)
  values (p_tenant_id, p_client_profile_id, 'email_triage', coalesce(p_payload, '{}'::jsonb), p_idempotency_key)
  on conflict (tenant_id, idempotency_key) do nothing;
  return query select * from public.task_queue where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
end;
$$;
revoke all on function public.enqueue_email_triage_task(uuid, uuid, text, jsonb, text) from public;
