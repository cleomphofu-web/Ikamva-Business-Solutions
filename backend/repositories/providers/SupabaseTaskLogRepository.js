/**
 * SupabaseTaskLogRepository.js
 *
 * Table: task_logs
 *
 *   id uuid primary key default gen_random_uuid()
 *   tenant_id text not null
 *   task_id uuid not null references task_queue(id)
 *   event_type text not null
 *   from_status text
 *   to_status text
 *   message text
 *   metadata jsonb default '{}'
 *   created_by text
 *   created_at timestamptz not null default now()
 */
export class SupabaseTaskLogRepository {
  constructor(supabase) {
    this.db = supabase;
  }

  async append(input) {
    const row = {
        tenant_id: input.tenant_id,
        task_id: input.task_id,
        from_status: input.from_status ?? null,
        to_status: input.to_status ?? null,
        message: input.message ?? null,
        metadata: input.metadata ?? {},
        created_by: input.created_by ?? 'system',
      };
    try {
    const { data, error } = await this.db
      .from('task_logs')
      .insert(row)
      .select()
      .single();
    if (error) { reportJsonWriteFailure('task_logs.metadata insert', row, error); throw error; }
    return data;
    } catch (error) { reportJsonWriteFailure('task_logs.metadata insert', row, error); throw error; }
  }

  async listByTaskId(taskId) {
    const { data, error } = await this.db
      .from('task_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
}
