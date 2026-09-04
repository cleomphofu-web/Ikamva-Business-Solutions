create or replace function public.claim_next_task(
  p_tenant_id uuid,
  p_worker_id text,
  p_task_types text[] default null,
  p_now timestamptz default now()
)
returns public.task_queue
language plpgsql
as $$
declare
  v_task public.task_queue;
begin
  with next_task as (
    select id
    from public.task_queue
    where tenant_id = p_tenant_id
      and status = 'pending'
      and scheduled_for <= p_now
      and (
        p_task_types is null
        or cardinality(p_task_types) = 0
        or task_type = any(p_task_types)
      )
    order by priority asc, created_at asc
    for update skip locked
    limit 1
  )
  update public.task_queue q
  set status = 'processing',
      locked_at = p_now,
      locked_by = p_worker_id,
      updated_at = now()
  from next_task
  where q.id = next_task.id
  returning q.* into v_task;

  return v_task;
end;
$$;
create or replace function public.recover_expired_tasks(
  p_tenant_id uuid,
  p_locked_before timestamptz,
  p_max_retries integer,
  p_now timestamptz default now(),
  p_worker_id text default 'recovery'
)
returns setof public.task_queue
language plpgsql
as $$
begin
  return query
  with expired as (
    select id, retry_count
    from public.task_queue
    where tenant_id = p_tenant_id
      and status = 'processing'
      and locked_at is not null
      and locked_at < p_locked_before
    order by locked_at asc
    for update skip locked
  ),
  updated as (
    update public.task_queue q
    set status = case when expired.retry_count >= p_max_retries then 'failed' else 'pending' end,
        retry_count = case when expired.retry_count >= p_max_retries then q.retry_count else q.retry_count + 1 end,
        scheduled_for = case when expired.retry_count >= p_max_retries then q.scheduled_for else p_now end,
        locked_at = null,
        locked_by = null,
        failed_at = case when expired.retry_count >= p_max_retries then p_now else q.failed_at end,
        updated_at = now()
    from expired
    where q.id = expired.id
    returning q.*
  )
  select * from updated;
end;
$$;
