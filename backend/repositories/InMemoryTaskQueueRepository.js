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

  async scheduleRetry(id, patch) {
    return this.updateStatus(id, patch.status, patch);
  }
}

const cryptoRandomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
