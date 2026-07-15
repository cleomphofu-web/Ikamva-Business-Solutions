import { TaskEvents, TaskStatuses } from '../domain/task-events.js';

export class QueueService {
  constructor({ taskQueueRepository, auditService, clock = () => new Date() }) {
    this.taskQueueRepository = taskQueueRepository;
    this.auditService = auditService;
    this.clock = clock;
  }

  async enqueueTask(input) {
    const existingTask = await this.taskQueueRepository.findByIdempotencyKey(input.tenant_id, input.idempotency_key);
    if (existingTask) {
      return existingTask;
    }

    const task = await this.taskQueueRepository.create({
      ...input,
      status: input.status || TaskStatuses.PENDING,
      priority: input.priority ?? 100,
      retry_count: input.retry_count ?? 0,
      scheduled_for: input.scheduled_for || this.clock().toISOString(),
    });

    await this.auditService.emit({
      task,
      eventType: TaskEvents.TASK_CREATED,
      toStatus: task.status,
      message: 'Task created',
      metadata: { idempotency_key: task.idempotency_key },
    });

    return task;
  }

  async claimNextTask({ tenantId, workerId, taskTypes = [] } = {}) {
    const task = await this.taskQueueRepository.claimNext({ tenantId, workerId, taskTypes, now: this.clock().toISOString() });
    if (!task) return null;

    await this.auditService.emit({
      task,
      eventType: TaskEvents.WORKER_STARTED,
      toStatus: task.status,
      message: 'Worker claimed task',
      metadata: { worker_id: workerId },
      createdBy: workerId || 'worker',
    });

    return task;
  }

  async transitionTask(task, status, { eventType, message, metadata = {}, createdBy = 'system' } = {}) {
    const previousStatus = task.status;
    const updatedTask = await this.taskQueueRepository.updateStatus(task.id, status, {
      metadata,
      completed_at: status === TaskStatuses.COMPLETED ? this.clock().toISOString() : undefined,
      failed_at: status === TaskStatuses.FAILED ? this.clock().toISOString() : undefined,
    });

    await this.auditService.emit({
      task: updatedTask,
      eventType: eventType || `TASK_${status.toUpperCase()}`,
      fromStatus: previousStatus,
      toStatus: status,
      message,
      metadata,
      createdBy,
    });

    return updatedTask;
  }

  async completeTask(task, result, options = {}) {
    return this.transitionTask(task, TaskStatuses.COMPLETED, {
      eventType: TaskEvents.TASK_COMPLETED,
      message: 'Task completed',
      metadata: { result },
      ...options,
    });
  }

  async failTask(task, error, options = {}) {
    return this.transitionTask(task, TaskStatuses.FAILED, {
      eventType: TaskEvents.TASK_FAILED,
      message: error?.message || 'Task failed',
      metadata: { error: serializeError(error) },
      ...options,
    });
  }

  async deadLetterTask(task, reason, options = {}) {
    return this.transitionTask(task, TaskStatuses.FAILED, {
      eventType: TaskEvents.TASK_DEAD_LETTERED,
      message: reason || 'Task moved to dead letter',
      metadata: { reason },
      ...options,
    });
  }

  async cancelTask(task, reason, options = {}) {
    return this.transitionTask(task, TaskStatuses.CANCELLED, {
      eventType: TaskEvents.TASK_CANCELLED,
      message: reason || 'Task cancelled',
      metadata: { reason },
      ...options,
    });
  }

  async retryTask(task, { delaySeconds = 60, reason } = {}) {
    const retryAt = new Date(this.clock().getTime() + delaySeconds * 1000).toISOString();
    const updatedTask = await this.taskQueueRepository.scheduleRetry(task.id, {
      scheduled_for: retryAt,
      retry_count: Number(task.retry_count || 0) + 1,
      status: TaskStatuses.PENDING,
    });

    await this.auditService.emit({
      task: updatedTask,
      eventType: TaskEvents.TASK_RETRY_SCHEDULED,
      fromStatus: task.status,
      toStatus: TaskStatuses.PENDING,
      message: 'Task retry scheduled',
      metadata: { retry_at: retryAt, reason },
    });

    return updatedTask;
  }

  async retryOrDeadLetterTask(task, { maxRetries = 3, delaySeconds = 60, reason } = {}) {
    if (Number(task.retry_count || 0) >= maxRetries) {
      return this.deadLetterTask(task, reason || 'Maximum retry attempts exceeded');
    }

    return this.retryTask(task, { delaySeconds, reason });
  }
}

const serializeError = error => ({
  name: error?.name || 'Error',
  message: error?.message || String(error),
  code: error?.code,
});
