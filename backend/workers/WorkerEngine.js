import { TaskEvents, TaskStatuses } from '../domain/task-events.js';
import { QuotaExceededError } from '../services/QuotaService.js';

export class WorkerEngine {
  constructor({
    queueService,
    sopService,
    quotaService,
    tenantRepository,
    providerRegistry,
    workerRegistry,
    auditService,
  }) {
    this.queueService = queueService;
    this.sopService = sopService;
    this.quotaService = quotaService;
    this.tenantRepository = tenantRepository;
    this.providerRegistry = providerRegistry;
    this.workerRegistry = workerRegistry;
    this.auditService = auditService;
  }

  async processNext({ tenantId, workerId, taskTypes = [] } = {}) {
    const task = await this.queueService.claimNextTask({ tenantId, workerId, taskTypes });
    if (!task) return null;

    return this.processTask(task, { workerId });
  }

  async processTask(task, { workerId = 'worker' } = {}) {
    try {
      await this.auditService.emit({
        task,
        eventType: TaskEvents.VALIDATION_STARTED,
        fromStatus: task.status,
        toStatus: TaskStatuses.VALIDATING,
        message: 'Validation started',
        createdBy: workerId,
      });

      const worker = this.workerRegistry.get(task.task_type);
      const sop = await this.sopService.loadActiveSOP({
        tenantId: task.tenant_id,
        taskType: task.task_type,
      });

      this.sopService.validateInput(sop, task.payload);
      const normalizedPayload = worker.normalizePayload(task.payload);

      await this.auditService.emit({
        task,
        eventType: TaskEvents.VALIDATION_COMPLETED,
        fromStatus: TaskStatuses.VALIDATING,
        toStatus: TaskStatuses.WAITING_QUOTA,
        message: 'Validation completed',
        metadata: { sop_id: sop.id },
        createdBy: workerId,
      });

      const clientProfile = await this.tenantRepository.findClientProfileById(task.client_profile_id);
      this.quotaService.ensureWithinQuota(clientProfile);

      await this.auditService.emit({
        task,
        eventType: TaskEvents.QUOTA_APPROVED,
        fromStatus: TaskStatuses.WAITING_QUOTA,
        toStatus: TaskStatuses.PROCESSING,
        message: 'Quota approved',
        metadata: { remaining_quota: this.quotaService.getRemainingQuota(clientProfile) },
        createdBy: workerId,
      });

      const provider = this.providerRegistry.get(worker.providerName || sop.model_provider || 'mock');
      const prompt = this.sopService.renderPrompt(sop, normalizedPayload);

      await this.auditService.emit({
        task,
        eventType: TaskEvents.AI_REQUESTED,
        toStatus: TaskStatuses.PROCESSING,
        message: 'Provider execution requested',
        metadata: { provider: worker.providerName || sop.model_provider || 'mock' },
        createdBy: workerId,
      });

      const result = await worker.execute({ provider, prompt, payload: normalizedPayload, sop, task });

      await this.auditService.emit({
        task,
        eventType: TaskEvents.AI_COMPLETED,
        toStatus: TaskStatuses.PROCESSING,
        message: 'Provider execution completed',
        metadata: { provider: result?.provider },
        createdBy: workerId,
      });

      await this.auditService.emit({
        task,
        eventType: TaskEvents.RESULT_VALIDATED,
        toStatus: TaskStatuses.PROCESSING,
        message: 'Result validated',
        createdBy: workerId,
      });

      if (task.client_profile_id) {
        await this.quotaService.incrementCompletedTaskCount(task.client_profile_id);
      }

      return this.queueService.completeTask(task, result, { createdBy: workerId });
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        await this.auditService.emit({
          task,
          eventType: TaskEvents.QUOTA_EXCEEDED,
          toStatus: TaskStatuses.QUOTA_EXCEEDED,
          message: error.message,
          createdBy: workerId,
        });
        return this.queueService.transitionTask(task, TaskStatuses.QUOTA_EXCEEDED, {
          eventType: TaskEvents.QUOTA_EXCEEDED,
          message: error.message,
          createdBy: workerId,
        });
      }

      return this.queueService.failTask(task, error, { createdBy: workerId });
    }
  }
}
