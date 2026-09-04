/**
 * SupabaseTaskQueueRepository.js
 *
 * Implements the TaskQueueRepository contract using Supabase.
 * Table: task_queue
 *
 * Required columns:
 *   id uuid primary key default gen_random_uuid()
 *   tenant_id text not null
 *   task_type text not null
 *   client_profile_id text
 *   idempotency_key text
 *   status text not null default 'pending'
 *   priority int not null default 100
 *   payload jsonb not null default '{}'
 *   normalized_payload jsonb not null default '{}'
 *   retry_count int not null default 0
 *   scheduled_for timestamptz
 *   locked_at timestamptz
 *   locked_by text
 *   completed_at timestamptz
 *   failed_at timestamptz
 *   created_at timestamptz not null default now()
 *   updated_at timestamptz not null default now()
 */
import { TaskStatuses } from '../../domain/task-events.js';
import { reportJsonWriteFailure } from '../../lib/db-write-diagnostics.js';

export class SupabaseTaskQueueRepository {
  constructor(supabase) {
    this.db = supabase;
  }

  async findById(id, tenantId) {
    let query = this.db
      .from('task_queue')
      .select('*')
      .eq('id', id);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async findByIdempotencyKey(tenantId, idempotencyKey) {
    const { data, error } = await this.db
      .from('task_queue')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async create(input) {
    const now = new Date().toISOString();
    const row = {
      tenant_id: input.tenant_id,
      task_type: input.task_type,
      client_profile_id: input.client_profile_id ?? null,
      idempotency_key: input.idempotency_key ?? null,
      status: input.status ?? TaskStatuses.PENDING,
      priority: input.priority ?? 100,
      payload: input.payload ?? {},
      normalized_payload: input.normalized_payload ?? {},
      retry_count: input.retry_count ?? 0,
      scheduled_for: input.scheduled_for ?? now,
    };

    try {
      const { data, error } = await this.db.from('task_queue').insert(row).select().single();
      if (error) { reportJsonWriteFailure('task_queue.payload insert', row, error); throw error; }
      return data;
    } catch (error) { reportJsonWriteFailure('task_queue.payload insert', row, error); throw error; }
  }

  async claimNext({ tenantId, workerId, taskTypes = [], now = new Date().toISOString() } = {}) {
    // Use a simple select + update pattern (not FOR UPDATE SKIP LOCKED, which
    // requires a stored procedure). For production scale, promote to RPC.
    let query = this.db
      .from('task_queue')
      .select('*')
      .eq('status', TaskStatuses.PENDING)
      .lte('scheduled_for', now)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1);

    if (tenantId) query = query.eq('tenant_id', tenantId);
    if (taskTypes.length > 0) query = query.in('task_type', taskTypes);

    const { data: candidates, error: selectError } = await query;
    if (selectError) throw selectError;
    if (!candidates || candidates.length === 0) return null;

    const task = candidates[0];
    return this.updateStatus(task.id, TaskStatuses.PROCESSING, {
      tenantId,
      locked_at: now,
      locked_by: workerId,
    });
  }

  async updateStatus(id, status, patch = {}) {
    const { tenantId, ...rowPatch } = patch;
    let query = this.db
      .from('task_queue')
      .update({
        ...rowPatch,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const patchPayload = { ...rowPatch, status };
    try {
      const { data, error } = await query.select().maybeSingle();
      if (error) { reportJsonWriteFailure('task_queue.payload update', patchPayload, error); throw error; }
      return data ?? null;
    } catch (error) { reportJsonWriteFailure('task_queue.payload update', patchPayload, error); throw error; }
  }

  async scheduleRetry(id, patch) {
    return this.updateStatus(id, patch.status, patch);
  }

  async recoverExpiredLocks({ timeoutMinutes = 10, tenantId } = {}) {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
    let query = this.db
      .from('task_queue')
      .update({ status: TaskStatuses.PENDING, locked_at: null, locked_by: null, updated_at: new Date().toISOString() })
      .eq('status', TaskStatuses.PROCESSING)
      .lt('locked_at', cutoff);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data, error } = await query.select();
    if (error) throw error;
    return data ?? [];
  }

  async getOperationalMetrics({ tenantId } = {}) {
    let query = this.db
      .from('task_queue')
      .select('status', { count: 'exact', head: false });
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data, error } = await query;
    if (error) throw error;
    const counts = {};
    for (const row of data ?? []) {
      counts[row.status] = (counts[row.status] || 0) + 1;
    }
    return counts;
  }
}
