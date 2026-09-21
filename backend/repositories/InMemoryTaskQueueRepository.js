import { TaskStatuses } from '../domain/task-events.js';

export class InMemoryTaskQueueRepository {
  constructor({ clock = () => new Date(), store } = {}) {
    this.clock = clock;
    this.tasks = store || new Map();
  }

  async findById(id) {
    return this.tasks.get(id) || null;
  }

  async findByIdempotencyKey(tenantId, idempotencyKey) {
    return [...this.tasks.values()].find(task => (
      task.tenant_id === tenantId && task.idempotency_key === idempotencyKey
    )) || null;
  }

  async create(input) {
    const now = this.clock().toISOString();
    const task = {
      id: input.id || cryptoRandomId(),
      created_at: now,
      updated_at: now,
      payload: {},
      normalized_payload: {},
      status: TaskStatuses.PENDING,
      ...input,
    };
    this.tasks.set(task.id, task);
    return { ...task };
  }

  async claimNext({ tenantId, workerId, taskTypes = [], now = this.clock().toISOString() } = {}) {
    const candidates = [...this.tasks.values()]
      .filter(task => task.status === TaskStatuses.PENDING)
      .filter(task => !tenantId || task.tenant_id === tenantId)
      .filter(task => taskTypes.length === 0 || taskTypes.includes(task.task_type))
      .filter(task => new Date(task.scheduled_for || task.created_at) <= new Date(now))
      .sort((a, b) => (
        (a.priority ?? 100) - (b.priority ?? 100)
        || new Date(a.created_at) - new Date(b.created_at)
      ));

    const task = candidates[0];
    if (!task) return null;

    return this.updateStatus(task.id, TaskStatuses.PROCESSING, {
      locked_at: now,
      locked_by: workerId,
    });
  }

  async updateStatus(id, status, patch = {}) {
    const existing = this.tasks.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...patch,
      status,
      updated_at: this.clock().toISOString(),
    };
    this.tasks.set(id, updated);
    return { ...updated };
  }

  /**
   * Atomic compare-and-set: transitions the task from expectedStatus → newStatus
   * only if its current status matches expectedStatus.
   * Returns the updated task on success, or null if the status didn't match
   * (i.e. another concurrent caller already transitioned it — treat as a no-op).
   *
   * In-memory equivalent of:
   *   UPDATE task_queue SET status = newStatus WHERE id = ? AND status = expectedStatus RETURNING *
   */
  async compareAndSetStatus(id, expectedStatus, newStatus, patch = {}) {
    const existing = this.tasks.get(id);
    if (!existing || existing.status !== expectedStatus) return null;

    const updated = {
      ...existing,
      ...patch,
      status: newStatus,
      updated_at: this.clock().toISOString(),
    };
    this.tasks.set(id, updated);
    return { ...updated };
  }

  async scheduleRetry(id, patch) {
    return this.updateStatus(id, patch.status, patch);
  }
  async updatePayload(id, tenantId, payload) { const task = this.tasks.get(id); if (!task || (tenantId && task.tenant_id !== tenantId)) return null; return this.updateStatus(id, task.status, { payload }); }

  async listByParentId(parentTaskId, tenantId) {
    return [...this.tasks.values()]
      .filter(task => task.parent_task_id === parentTaskId && (!tenantId || task.tenant_id === tenantId))
      .sort((a, b) => (a.step_index ?? 0) - (b.step_index ?? 0));
  }
  async listByType(taskType, tenantId) { return [...this.tasks.values()].filter((task) => task.task_type === taskType && (!tenantId || task.tenant_id === tenantId)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); }
  async listRecent(tenantId, limit = 100) { return [...this.tasks.values()].filter(task => !tenantId || task.tenant_id === tenantId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit); }

  async recoverExpiredLocks({ timeoutMinutes = 5, maxRetries = 3, tenantId, now = this.clock() } = {}) {
    const cutoff = new Date(new Date(now).getTime() - timeoutMinutes * 60 * 1000);
    const recovered = [];
    for (const task of this.tasks.values()) {
      if (task.status !== TaskStatuses.PROCESSING || (tenantId && task.tenant_id !== tenantId)) continue;
      if (!task.locked_at || new Date(task.locked_at) >= cutoff) continue;
      recovered.push(await this.updateStatus(task.id, (task.retry_count ?? 0) >= maxRetries ? TaskStatuses.FAILED : TaskStatuses.PENDING, {
        locked_at: null,
        locked_by: null,
        retry_count: (task.retry_count ?? 0) >= maxRetries ? task.retry_count : (task.retry_count ?? 0) + 1,
        failed_at: (task.retry_count ?? 0) >= maxRetries ? new Date(now).toISOString() : task.failed_at,
      }));
    }
    return recovered;
  }

  async getOperationalMetrics({ tenantId } = {}) {
    const counts = {};
    for (const task of this.tasks.values()) {
      if (tenantId && task.tenant_id !== tenantId) continue;
      counts[task.status] = (counts[task.status] || 0) + 1;
    }
    return counts;
  }
}

const cryptoRandomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
