import assert from 'node:assert/strict';
import test from 'node:test';
import { GmailMCPProvider } from '../providers/GmailMCPProvider.js';
import { InMemoryTaskQueueRepository } from '../repositories/InMemoryTaskQueueRepository.js';
import { InMemoryTaskLogRepository } from '../repositories/InMemoryTaskLogRepository.js';
import { AuditService } from '../services/AuditService.js';
import { QueueService } from '../services/QueueService.js';
import { WorkerEngine } from '../workers/WorkerEngine.js';
import { EmailWorker } from '../workers/EmailWorker.js';
import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { TaskStatuses } from '../domain/task-events.js';

test('Gmail approval path records immutable audit sequence through awaiting_human', async () => {
  const taskQueueRepository = new InMemoryTaskQueueRepository();
  const taskLogRepository = new InMemoryTaskLogRepository();
  const auditService = new AuditService({ taskLogRepository });
  const queueService = new QueueService({ taskQueueRepository, auditService });
  const task = await queueService.enqueueTask({
    tenant_id: 'tenant-a', client_profile_id: 'client-a', task_type: 'email',
    payload: { to: 'client@example.com', subject: 'Update', text: 'Your update is ready.' },
    idempotency_key: 'gmail-approval-1', scheduled_for: new Date().toISOString(),
  });
  const claimed = await queueService.claimNextTask({ tenantId: 'tenant-a', workerId: 'worker-1' });
  const providers = new ProviderRegistry({ 'gmail-mcp': new GmailMCPProvider() });
  const engine = new WorkerEngine({
    queueService, auditService, providerRegistry: providers,
    workerRegistry: { get: () => new EmailWorker({ providerName: 'gmail-mcp' }) },
    sopService: { loadActiveSOP: async () => ({ id: 'sop-1', model_provider: 'gmail-mcp' }), validateInput: () => {}, renderPrompt: () => 'email prompt' },
    quotaService: { ensureWithinQuota: () => {}, getRemainingQuota: () => 1 },
    tenantRepository: { findClientProfileById: async () => ({}) },
  });

  await engine.processTask(claimed, { workerId: 'worker-1' });
  const finalTask = await taskQueueRepository.findById(task.id);
  const logs = [...taskLogRepository.logs].filter(log => log.task_id === task.id);
  const events = logs.map(log => log.metadata.event_type);

  assert.equal(finalTask.status, TaskStatuses.AWAITING_HUMAN);
  assert.deepEqual(events, ['TASK_CREATED', 'WORKER_STARTED', 'VALIDATION_STARTED', 'VALIDATION_COMPLETED', 'QUOTA_APPROVED', 'AI_REQUESTED', 'AI_COMPLETED', 'AWAITING_HUMAN']);
  assert.equal(logs.at(-1).metadata.provider, 'gmail-mcp');
});
