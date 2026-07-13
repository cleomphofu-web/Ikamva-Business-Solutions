import { TaskEvents } from '../domain/task-events.js';

export class AuditService {
  constructor({ taskLogRepository }) {
    this.taskLogRepository = taskLogRepository;
  }

  async emit({ task, eventType, fromStatus = null, toStatus = task?.status, message, metadata = {}, createdBy = 'system' }) {
    if (!task?.id || !task?.tenant_id) {
      throw new Error('AuditService.emit requires a task with id and tenant_id.');
    }

    return this.taskLogRepository.append({
      task_id: task.id,
      tenant_id: task.tenant_id,
      from_status: fromStatus,
      to_status: toStatus,
      message: message || eventType,
      metadata: {
        event_type: eventType,
        ...metadata,
      },
      created_by: createdBy,
    });
  }

  async taskCreated(task, metadata = {}) {
    return this.emit({ task, eventType: TaskEvents.TASK_CREATED, message: 'Task created', metadata });
  }
}
