import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TaskEvents, TaskStatuses } from '../../domain/task-events.js';
import { QueueService } from '../../services/QueueService.js';
import { AuditService } from '../../services/AuditService.js';
import { QuotaExceededError, QuotaService } from '../../services/QuotaService.js';

const baseTask = overrides => ({
  tenant_id: 'tenant-1',
  client_profile_id: 'client-1',
  task_type: 'email',
  payload: { subject: 'Hello' },
  idempotency_key: `idem-${Math.random().toString(16).slice(2)}`,
  ...overrides,
});

export function defineQueueRepositoryContractTests(name, createHarness) {
  describe(`${name} queue repository contract`, () => {
    const createQueue = async () => {
      const harness = await createHarness();
      const auditService = new AuditService({ taskLogRepository: harness.taskLogRepository });
      const queueService = new QueueService({
        taskQueueRepository: harness.taskQueueRepository,
        auditService,
        clock: harness.clock,
      });

      return { ...harness, auditService, queueService };
    };

    it('enqueueing creates a pending task and audit event', async () => {
      const { queueService, taskLogRepository } = await createQueue();

      const task = await queueService.enqueueTask(baseTask({ idempotency_key: 'enqueue-1' }));
      const logs = await taskLogRepository.listByTaskId(task.id);

      assert.equal(task.status, TaskStatuses.PENDING);
      assert.equal(task.retry_count, 0);
      assert.equal(logs.at(-1).metadata.event_type, TaskEvents.TASK_CREATED);
    });

    it('duplicate idempotency keys return the existing task', async () => {
      const { queueService } = await createQueue();

      const first = await queueService.enqueueTask(baseTask({ idempotency_key: 'same-key' }));
      const second = await queueService.enqueueTask(baseTask({
        idempotency_key: 'same-key',
        payload: { subject: 'Changed payload should not create a second task' },
      }));

      assert.equal(second.id, first.id);
      assert.deepEqual(second.payload, first.payload);
    });

    it('claiming tasks locks the highest-priority eligible task', async () => {
      const { queueService } = await createQueue();

      await queueService.enqueueTask(baseTask({ idempotency_key: 'low', priority: 200 }));
      const high = await queueService.enqueueTask(baseTask({ idempotency_key: 'high', priority: 10 }));

      const claimed = await queueService.claimNextTask({ tenantId: 'tenant-1', workerId: 'worker-a' });

      assert.equal(claimed.id, high.id);
      assert.equal(claimed.status, TaskStatuses.PROCESSING);
      assert.equal(claimed.locked_by, 'worker-a');
      assert.ok(claimed.locked_at);
    });

    it('concurrent claims do not claim the same task twice', async () => {
      const { queueService } = await createQueue();

      const task = await queueService.enqueueTask(baseTask({ idempotency_key: 'concurrent-claim' }));

      const [first, second] = await Promise.all([
        queueService.claimNextTask({ tenantId: 'tenant-1', workerId: 'worker-a' }),
        queueService.claimNextTask({ tenantId: 'tenant-1', workerId: 'worker-b' }),
      ]);

      const claimed = [first, second].filter(Boolean);
      assert.equal(claimed.length, 1);
      assert.equal(claimed[0].id, task.id);
    });

    it('retrying tasks increments retry count and reschedules as pending', async () => {
      const { queueService } = await createQueue();

      await queueService.enqueueTask(baseTask({ idempotency_key: 'retry-1' }));
      const claimed = await queueService.claimNextTask({ tenantId: 'tenant-1', workerId: 'worker-a' });
      const retried = await queueService.retryTask(claimed, { delaySeconds: 30, reason: 'temporary failure' });

      assert.equal(retried.status, TaskStatuses.PENDING);
      assert.equal(retried.retry_count, 1);
      assert.ok(new Date(retried.scheduled_for) > new Date(claimed.scheduled_for));
    });

    it('completion marks a task completed and records output metadata', async () => {
      const { queueService, taskLogRepository } = await createQueue();

      await queueService.enqueueTask(baseTask({ idempotency_key: 'complete-1' }));
      const claimed = await queueService.claimNextTask({ tenantId: 'tenant-1', workerId: 'worker-a' });
      const completed = await queueService.completeTask(claimed, { ok: true });
      const logs = await taskLogRepository.listByTaskId(completed.id);

      assert.equal(completed.status, TaskStatuses.COMPLETED);
      assert.ok(completed.completed_at);
      assert.equal(logs.at(-1).metadata.event_type, TaskEvents.TASK_COMPLETED);
      assert.deepEqual(logs.at(-1).metadata.result, { ok: true });
    });

    it('cancellation marks a task cancelled and records the reason', async () => {
      const { queueService, taskLogRepository } = await createQueue();

      const task = await queueService.enqueueTask(baseTask({ idempotency_key: 'cancel-1' }));
      const cancelled = await queueService.cancelTask(task, 'client requested cancellation');
      const logs = await taskLogRepository.listByTaskId(cancelled.id);

      assert.equal(cancelled.status, TaskStatuses.CANCELLED);
      assert.equal(logs.at(-1).metadata.event_type, TaskEvents.TASK_CANCELLED);
      assert.equal(logs.at(-1).metadata.reason, 'client requested cancellation');
    });

    it('failure marks a task failed and stores serialized error details', async () => {
      const { queueService, taskLogRepository } = await createQueue();

      const task = await queueService.enqueueTask(baseTask({ idempotency_key: 'fail-1' }));
      const failed = await queueService.failTask(task, Object.assign(new Error('provider failed'), { code: 'provider_error' }));
      const logs = await taskLogRepository.listByTaskId(failed.id);

      assert.equal(failed.status, TaskStatuses.FAILED);
      assert.ok(failed.failed_at);
      assert.equal(logs.at(-1).metadata.event_type, TaskEvents.TASK_FAILED);
      assert.equal(logs.at(-1).metadata.error.code, 'provider_error');
    });

    it('quota handling rejects work when no monthly quota remains', async () => {
      const { taskQueueRepository, tenantRepository } = await createHarness({
        clientProfiles: [{
          id: 'client-quota',
          monthly_task_limit: 1,
          tasks_used_this_month: 1,
        }],
      });
      const quotaService = new QuotaService({ tenantRepository });
      const clientProfile = await tenantRepository.findClientProfileById('client-quota');
      const task = await taskQueueRepository.create(baseTask({
        client_profile_id: 'client-quota',
        idempotency_key: 'quota-1',
      }));

      await assert.rejects(
        () => quotaService.rejectWhenExceeded(clientProfile, taskQueueRepository, task.id),
        QuotaExceededError,
      );

      const updated = await taskQueueRepository.findById(task.id);
      assert.equal(updated.status, TaskStatuses.QUOTA_EXCEEDED);
    });

    it('quota handling increments completed task counts', async () => {
      const { tenantRepository } = await createHarness({
        clientProfiles: [{
          id: 'client-increment',
          monthly_task_limit: 5,
          tasks_used_this_month: 2,
        }],
      });
      const quotaService = new QuotaService({ tenantRepository });

      const updated = await quotaService.incrementCompletedTaskCount('client-increment');

      assert.equal(updated.tasks_used_this_month, 3);
      assert.equal(quotaService.getRemainingQuota(updated), 2);
    });

    it('dead-letter behavior marks exhausted retries as failed with a dead-letter audit event', async () => {
      const { queueService, taskLogRepository } = await createQueue();

      const task = await queueService.enqueueTask(baseTask({
        idempotency_key: 'dead-letter-1',
        retry_count: 3,
      }));
      const claimed = await queueService.claimNextTask({ tenantId: 'tenant-1', workerId: 'worker-a' });
      const deadLettered = await queueService.retryOrDeadLetterTask(claimed, {
        maxRetries: 3,
        reason: 'exhausted retries',
      });
      const logs = await taskLogRepository.listByTaskId(task.id);

      assert.equal(deadLettered.status, TaskStatuses.FAILED);
      assert.equal(logs.at(-1).metadata.event_type, TaskEvents.TASK_DEAD_LETTERED);
      assert.equal(logs.at(-1).metadata.reason, 'exhausted retries');
    });
  });
}
