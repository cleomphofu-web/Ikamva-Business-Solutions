import test from 'node:test';
import assert from 'node:assert/strict';
import { QuotaService, QuotaExceededError } from '../services/QuotaService.js';
import { TaskChainService } from '../services/TaskChainService.js';
import { QueueService } from '../services/QueueService.js';
import { AuditService } from '../services/AuditService.js';
import { InMemoryTaskQueueRepository } from '../repositories/InMemoryTaskQueueRepository.js';
import { InMemoryTaskLogRepository } from '../repositories/InMemoryTaskLogRepository.js';
import { InMemoryTenantRepository } from '../repositories/InMemoryTenantRepository.js';
import { createInMemoryRepositoryProvider } from '../repositories/providers/InMemoryRepositoryProvider.js';
import { WorkerEngine } from '../workers/WorkerEngine.js';
import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { WorkerRegistry } from '../workers/WorkerRegistry.js';
import { MockAIProvider } from '../providers/MockAIProvider.js';
import { BaseWorker } from '../workers/BaseWorker.js';
import { SOPService } from '../services/SOPService.js';

test('QuotaService: basic calculation, ensureWithinQuota, and task-pack fields', async () => {
  const repo = new InMemoryTenantRepository([
    { id: 'profile-1', tenant_id: 'tenant-1', pack_size: 5, tasks_used_this_cycle: 2 },
    { id: 'profile-2', tenant_id: 'tenant-1', pack_size: 3, tasks_used_this_cycle: 3 },
  ]);
  const quotaService = new QuotaService({ tenantRepository: repo });

  const p1 = await repo.findClientProfileById('profile-1');
  assert.equal(quotaService.getRemainingQuota(p1), 3);
  assert.equal(quotaService.ensureWithinQuota(p1), 3);

  const p2 = await repo.findClientProfileById('profile-2');
  assert.equal(quotaService.getRemainingQuota(p2), 0);
  assert.throws(() => quotaService.ensureWithinQuota(p2), QuotaExceededError);
});

test('Section 4 End-to-End: 3-pack workflow execution, atomic increment, 4th blocked, and needs_attention transition', async () => {
  const clientProfileId = 'profile-test';
  const tenantId = 'tenant-test';

  const tenantRepo = new InMemoryTenantRepository([
    {
      id: clientProfileId,
      tenant_id: tenantId,
      pack_size: 3,
      tasks_used_this_cycle: 0,
    }
  ]);
  const memoryProvider = createInMemoryRepositoryProvider({
    stores: {
      employees: [
        {
          id: clientProfileId,
          tenant_id: tenantId,
          name: 'Thabo',
          lifecycle_status: 'active',
          configuration: { skills: ['support', 'sales'] },
        }
      ]
    }
  });
  const employeeRepo = memoryProvider.createSystemRepositories().employees;
  const taskQueueRepo = new InMemoryTaskQueueRepository();
  const taskLogsRepo = new InMemoryTaskLogRepository();
  const auditService = new AuditService({ taskLogRepository: taskLogsRepo });
  const queueService = new QueueService({ taskQueueRepository: taskQueueRepo, auditService });
  const quotaService = new QuotaService({ tenantRepository: tenantRepo });

  const chainConfig = {
    name: 'Customer Email to Quote Workflow',
    steps: [
      { name: 'Read Email', task_type: 'email_read' },
      { name: 'Generate Quote', task_type: 'quote_generate' },
      { name: 'Send Email', task_type: 'email_send' },
    ]
  };

  const taskChainService = new TaskChainService({
    queueService,
    taskQueueRepository: taskQueueRepo,
    auditService,
    employeeRepository: employeeRepo,
    taskLogRepository: taskLogsRepo,
    quotaService,
    tenantRepository: tenantRepo,
  });

  // Helper to run a 3-step chain to completion
  // chainConfig has 3 steps (index 0, 1, 2)
  // createChain enqueues step 0 (firstStepTaskId)
  // advanceChain(firstStepTaskId) enqueues step 1 and returns it (step1)
  // advanceChain(step1.id) enqueues step 2 and returns it (step2)
  // advanceChain(step2.id) completes the parent and returns completed parent
  async function runChain(chainNum) {
    const { parentTaskId, firstStepTaskId } = await taskChainService.createChain(
      tenantId,
      clientProfileId,
      chainConfig,
      { emailId: `email-${chainNum}`, message: `Hello ${chainNum}` }
    );

    // Step 0 (email_read) -> advance to Step 1 (quote_generate)
    const step1 = await taskChainService.advanceChain(firstStepTaskId, { output: { text: 'read' } });
    assert.ok(step1, 'step1 enqueued');

    // Step 1 (quote_generate) -> advance to Step 2 (email_send)
    const step2 = await taskChainService.advanceChain(step1.id, { output: { quote: 100 } });
    assert.ok(step2, 'step2 enqueued');

    // Step 2 (email_send) -> advance to completion
    const completedParent = await taskChainService.advanceChain(step2.id, { output: { sent: true } });
    assert.ok(completedParent, 'parent completed');
    assert.equal(completedParent.status, 'completed');
    return parentTaskId;
  }

  // Run Chain 1
  await runChain(1);
  let profile = await tenantRepo.findClientProfileById(clientProfileId);
  assert.equal(profile.tasks_used_this_cycle, 1, 'Chain 1 consumed exactly 1 task credit');
  let emp = await employeeRepo.findByTenant(tenantId);
  assert.equal(emp.lifecycle_status, 'active');

  // Run Chain 2
  await runChain(2);
  profile = await tenantRepo.findClientProfileById(clientProfileId);
  assert.equal(profile.tasks_used_this_cycle, 2, 'Chain 2 consumed exactly 1 task credit (total 2)');

  // Run Chain 3
  await runChain(3);
  profile = await tenantRepo.findClientProfileById(clientProfileId);
  assert.equal(profile.tasks_used_this_cycle, 3, 'Chain 3 consumed exactly 1 task credit (total 3/3)');

  // Confirm Employee transitioned to 'needs_attention' with 'quota_exhausted' reason
  emp = await employeeRepo.findByTenant(tenantId);
  assert.equal(emp.lifecycle_status, 'needs_attention');
  assert.equal(emp.lifecycle_metadata?.reason, 'quota_exhausted');
  assert.equal(emp.lifecycle_metadata?.pack_size, 3);
  assert.equal(emp.lifecycle_metadata?.tasks_used, 3);

  // Attempting Chain 4 MUST throw QuotaExceededError and be blocked from creating tasks
  await assert.rejects(
    async () => {
      await taskChainService.createChain(
        tenantId,
        clientProfileId,
        chainConfig,
        { emailId: 'email-4', message: 'Hello 4' }
      );
    },
    (err) => err instanceof QuotaExceededError
  );

  // Idempotency check: running advanceChain again on the completed final step does NOT double-decrement quota
  const allTasks = await taskQueueRepo.listByType('email_send');
  const lastStep = allTasks[allTasks.length - 1];
  await taskChainService.advanceChain(lastStep.id, { output: { sent: true } });
  profile = await tenantRepo.findClientProfileById(clientProfileId);
  assert.equal(profile.tasks_used_this_cycle, 3, 'Idempotency preserved: no double decrement');
});

test('Standalone Metering: audience=account_owner (Manager chat) does NOT consume quota, audience=end_customer DOES', async () => {
  const clientProfileId = 'profile-chat';
  const tenantId = 'tenant-chat';

  const tenantRepo = new InMemoryTenantRepository([
    {
      id: clientProfileId,
      tenant_id: tenantId,
      plan: 'growth',
      pack_size: 10,
      tasks_used_this_cycle: 0,
    }
  ]);
  const memoryProvider = createInMemoryRepositoryProvider({
    stores: {
      employees: [
        {
          id: clientProfileId,
          tenant_id: tenantId,
          name: 'Manager Zondi',
          lifecycle_status: 'active',
          configuration: { skills: ['support', 'email'] },
        }
      ]
    }
  });
  const employeeRepo = memoryProvider.createSystemRepositories().employees;
  const taskQueueRepo = new InMemoryTaskQueueRepository();
  const taskLogsRepo = new InMemoryTaskLogRepository();
  const auditService = new AuditService({ taskLogRepository: taskLogsRepo });
  const queueService = new QueueService({ taskQueueRepository: taskQueueRepo, auditService });
  const quotaService = new QuotaService({ tenantRepository: tenantRepo });

  const providers = new ProviderRegistry({
    mock: new MockAIProvider({ defaultResponse: 'Hello boss!' }),
  });
  const workers = new WorkerRegistry({
    chat: new BaseWorker({ taskType: 'chat', providerName: 'mock' }),
    email_response: new BaseWorker({ taskType: 'email_response', providerName: 'mock' }),
  });

  const engine = new WorkerEngine({
    queueService,
    sopService: new SOPService({
      sopRepository: {
        findActiveByTaskType: async () => ({
          id: 'sop-1',
          name: 'Chat',
          model_provider: 'mock',
          renderPrompt: () => 'prompt',
        }),
      },
    }),
    quotaService,
    tenantRepository: tenantRepo,
    employeeRepository: employeeRepo,
    taskQueueRepository: taskQueueRepo,
    providerRegistry: providers,
    workerRegistry: workers,
    auditService,
  });

  // 1. Account Owner chat (Manager check-in)
  const chatTask = await queueService.enqueueTask({
    tenant_id: tenantId,
    client_profile_id: clientProfileId,
    task_type: 'chat',
    idempotency_key: 'chat-1',
    payload: { message: 'how is my team doing', audience: 'internal' },
  });

  await engine.processTask(chatTask, { workerId: 'worker-1' });

  let profile = await tenantRepo.findClientProfileById(clientProfileId);
  assert.equal(profile.tasks_used_this_cycle, 0, 'Internal account_owner chat did NOT burn a quota unit');

  // 2. Standalone Customer-Facing Email Response (audience: end_customer)
  const customerEmailTask = await queueService.enqueueTask({
    tenant_id: tenantId,
    client_profile_id: clientProfileId,
    task_type: 'email_response',
    idempotency_key: 'email-1',
    payload: { message: 'Inquiry from customer', sender: 'cust@example.com', audience: 'end_customer' },
  });

  await engine.processTask(customerEmailTask, { workerId: 'worker-1' });

  profile = await tenantRepo.findClientProfileById(clientProfileId);
  assert.equal(profile.tasks_used_this_cycle, 1, 'Customer-facing task DID consume 1 quota unit');
});

test('Concurrent advanceChain on final step: quota increments exactly once, parent completes exactly once', async () => {
  const clientProfileId = 'profile-concurrent';
  const tenantId = 'tenant-concurrent';

  const tenantRepo = new InMemoryTenantRepository([
    { id: clientProfileId, tenant_id: tenantId, pack_size: 5, tasks_used_this_cycle: 0 },
  ]);
  const taskQueueRepo = new InMemoryTaskQueueRepository();
  const taskLogsRepo = new InMemoryTaskLogRepository();
  const auditService = new AuditService({ taskLogRepository: taskLogsRepo });
  const queueService = new QueueService({ taskQueueRepository: taskQueueRepo, auditService });
  const quotaService = new QuotaService({ tenantRepository: tenantRepo });

  const chainConfig = {
    name: 'Two-Step Chain',
    steps: [
      { name: 'Step A', task_type: 'email_read' },
      { name: 'Step B', task_type: 'email_send' },
    ],
  };

  const svc = new TaskChainService({
    queueService,
    taskQueueRepository: taskQueueRepo,
    auditService,
    quotaService,
    tenantRepository: tenantRepo,
  });

  // Create chain and advance to the final step
  const { firstStepTaskId } = await svc.createChain(tenantId, clientProfileId, chainConfig, { emailId: 'e1' });
  const finalStep = await svc.advanceChain(firstStepTaskId, { output: { text: 'read' } });

  // Fire the final-step advance twice concurrently — simulates two workers racing on the same task
  const results = await Promise.all([
    svc.advanceChain(finalStep.id, { output: { sent: true } }),
    svc.advanceChain(finalStep.id, { output: { sent: true } }),
  ]);

  // Exactly one call should have won the CAS slot and completed the parent
  const completedResults = results.filter(r => r && r.status === 'completed');
  assert.equal(completedResults.length, 1, 'Parent should complete exactly once');

  // Quota must increment exactly once regardless of concurrent calls
  const profile = await tenantRepo.findClientProfileById(clientProfileId);
  assert.equal(profile.tasks_used_this_cycle, 1, 'Quota must increment exactly once under concurrent advance');
});

test('resumeApprovedTask audience guard: account_owner approval does NOT consume quota, end_customer DOES', async () => {
  const clientProfileId = 'profile-resume';
  const tenantId = 'tenant-resume';

  const tenantRepo = new InMemoryTenantRepository([
    { id: clientProfileId, tenant_id: tenantId, pack_size: 10, tasks_used_this_cycle: 0 },
  ]);
  const memoryProvider = createInMemoryRepositoryProvider({
    stores: {
      employees: [{
        id: clientProfileId, tenant_id: tenantId, name: 'Amahle',
        lifecycle_status: 'active', configuration: { skills: ['support'] },
      }],
    },
  });
  const employeeRepo = memoryProvider.createSystemRepositories().employees;
  const taskQueueRepo = new InMemoryTaskQueueRepository();
  const taskLogsRepo = new InMemoryTaskLogRepository();
  const auditService = new AuditService({ taskLogRepository: taskLogsRepo });
  const queueService = new QueueService({ taskQueueRepository: taskQueueRepo, auditService });
  const quotaService = new QuotaService({ tenantRepository: tenantRepo });

  const engine = new WorkerEngine({
    queueService,
    sopService: new SOPService({
      sopRepository: { findActiveByTaskType: async () => ({ id: 'sop-1', model_provider: 'mock', renderPrompt: () => 'prompt' }) },
    }),
    quotaService,
    tenantRepository: tenantRepo,
    employeeRepository: employeeRepo,
    taskQueueRepository: taskQueueRepo,
    providerRegistry: new ProviderRegistry({ mock: new MockAIProvider({ defaultResponse: 'ok' }) }),
    workerRegistry: new WorkerRegistry({
      chat: new BaseWorker({ taskType: 'chat', providerName: 'mock' }),
      email_response: new BaseWorker({ taskType: 'email_response', providerName: 'mock' }),
    }),
    auditService,
  });

  // Minimal approval stub
  const approvalStub = { id: 'appr-1', action_payload: { to: 'user@example.com', subject: 'Test', text: 'Hello' } };

  // 1. account_owner chat task through approval path — must NOT consume quota
  const chatTask = await queueService.enqueueTask({
    tenant_id: tenantId, client_profile_id: clientProfileId,
    task_type: 'chat', idempotency_key: 'resume-chat-1',
    payload: { message: 'approve this', audience: 'account_owner' },
    status: 'awaiting_human',
  });
  await engine.resumeApprovedTask(chatTask, approvalStub, { workerId: 'test' });
  let profile = await tenantRepo.findClientProfileById(clientProfileId);
  assert.equal(profile.tasks_used_this_cycle, 0, 'resumeApprovedTask for account_owner chat must NOT burn quota');

  // 2. end_customer email_response task through approval path — must consume quota
  const emailTask = await queueService.enqueueTask({
    tenant_id: tenantId, client_profile_id: clientProfileId,
    task_type: 'email_response', idempotency_key: 'resume-email-1',
    payload: { sender: 'customer@example.com', audience: 'end_customer' },
    status: 'awaiting_human',
  });
  await engine.resumeApprovedTask(emailTask, { ...approvalStub, id: 'appr-2' }, { workerId: 'test' });
  profile = await tenantRepo.findClientProfileById(clientProfileId);
  assert.equal(profile.tasks_used_this_cycle, 1, 'resumeApprovedTask for end_customer task must consume 1 quota unit');
});

