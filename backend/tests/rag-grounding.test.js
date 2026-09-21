import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryCompanyKnowledgeRepository } from '../repositories/InMemoryCompanyKnowledgeRepository.js';
import { InMemoryTaskQueueRepository } from '../repositories/InMemoryTaskQueueRepository.js';
import { InMemoryTaskLogRepository } from '../repositories/InMemoryTaskLogRepository.js';
import { createInMemoryRepositoryProvider } from '../repositories/providers/InMemoryRepositoryProvider.js';
import { QueueService } from '../services/QueueService.js';
import { AuditService } from '../services/AuditService.js';
import { WorkerEngine } from '../workers/WorkerEngine.js';
import { TaskStatuses } from '../domain/task-events.js';
import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { WorkerRegistry } from '../workers/WorkerRegistry.js';
import { MockAIProvider } from '../providers/MockAIProvider.js';
import { BaseWorker } from '../workers/BaseWorker.js';
import { SOPService } from '../services/SOPService.js';

class TestMockWorker extends BaseWorker {
  constructor() { super({ taskType: 'email_triage', providerName: 'mock' }); }
  async execute({ provider, prompt, payload }) {
    return { provider: 'mock', output: { content: 'Mock response generated successfully' } };
  }
}

class TestChatWorker extends BaseWorker {
  constructor() { super({ taskType: 'chat', providerName: 'mock' }); }
  async execute({ provider, prompt, payload }) {
    return { provider: 'mock', output: { content: 'Chat response generated' } };
  }
}

function setupWorkerEngine(overrides = {}) {
  const providerStores = createInMemoryRepositoryProvider({
    stores: {
      sops: [
        {
          id: 'sop-email',
          tenant_id: overrides.tenantId || 'tenant-a',
          task_type: 'email_triage',
          version: 1,
          active: true,
          model_provider: 'mock',
          system_prompt: 'Handle customer triage',
          validation_schema: { required: [] },
        },
        {
          id: 'sop-chat',
          tenant_id: overrides.tenantId || 'tenant-a',
          task_type: 'chat',
          version: 1,
          active: true,
          model_provider: 'mock',
          system_prompt: 'Handle owner chat',
          validation_schema: { required: [] },
        },
      ],
    },
  }).createSystemRepositories();
  const taskQueueRepo = overrides.taskQueueRepo || new InMemoryTaskQueueRepository();
  const taskLogRepo = overrides.taskLogRepo || new InMemoryTaskLogRepository();
  const approvalRepo = overrides.approvalRepo || providerStores.approvals;
  const auditService = overrides.auditService || new AuditService({ taskLogRepository: taskLogRepo });
  const queueService = overrides.queueService || new QueueService({
    taskQueueRepository: taskQueueRepo,
    taskLogRepository: taskLogRepo,
    auditService,
  });
  const knowledgeRepo = overrides.knowledgeRepo || new InMemoryCompanyKnowledgeRepository();

  const providerRegistry = new ProviderRegistry();
  providerRegistry.register('mock', new MockAIProvider({ defaultResponse: 'Mock AI response' }));

  const workerRegistry = new WorkerRegistry();
  workerRegistry.register('email_triage', new TestMockWorker());
  workerRegistry.register('chat', new TestChatWorker());

  const engine = new WorkerEngine({
    queueService,
    sopService: new SOPService({ sopRepository: providerStores.sops }),
    quotaService: { ensureWithinQuota: () => 10, getRemainingQuota: () => 10 },
    tenantRepository: {
      findClientProfileById: async () => ({ id: 'prof-1', plan: 'growth', pack_size: 10, tasks_used_this_cycle: 0 }),
      findByTenant: async () => ({ id: 'prof-1', plan: 'growth', pack_size: 10, tasks_used_this_cycle: 0 }),
    },
    employeeRepository: overrides.employeeRepository || {
      findById: async (id) => ({
        id,
        tenant_id: overrides.tenantId || 'tenant-a',
        name: 'Sipho',
        lifecycle_status: 'active',
        configuration: {
          skills: ['email_triage', 'chat', 'support', 'sales'],
          job_spec: overrides.jobSpec || {},
        },
      }),
      findByTenant: async (tenantId) => ({
        id: 'emp-1',
        tenant_id: tenantId || overrides.tenantId || 'tenant-a',
        name: 'Sipho',
        lifecycle_status: 'active',
        configuration: {
          skills: ['email_triage', 'chat', 'support', 'sales'],
          job_spec: overrides.jobSpec || {},
        },
      }),
    },
    employeeActivityLogRepository: null,
    employeeMemoryRepository: null,
    companyKnowledgeRepository: knowledgeRepo,
    embeddingService: null,
    providerRegistry,
    workerRegistry,
    auditService,
    approvalRepository: approvalRepo,
    tenantIntegrations: null,
    gmailMessageService: null,
    taskChainService: null,
    contactRepository: null,
    providerUsageService: null,
    specialistRepository: null,
    taskQueueRepository: taskQueueRepo,
    ...overrides,
  });

  return { engine, knowledgeRepo, approvalRepo, taskQueueRepo, taskLogRepo, auditService, queueService };
}

test('1. Multi-tenant isolation: Tenant A and Tenant B never cross-contaminate knowledge', async () => {
  const knowledgeRepo = new InMemoryCompanyKnowledgeRepository();
  await knowledgeRepo.createChunks('tenant-a', [
    { source: 'pricing.pdf', content: 'Tenant A exclusive pricing is R500 per unit.' },
  ]);
  await knowledgeRepo.createChunks('tenant-b', [
    { source: 'pricing.pdf', content: 'Tenant B secret pricing is R9500 enterprise tier.' },
  ]);

  // Query tenant A
  const resultsA = await knowledgeRepo.search('tenant-a', 'pricing');
  assert.equal(resultsA.length, 1);
  assert.ok(resultsA[0].content.includes('Tenant A exclusive pricing'));
  assert.ok(!resultsA[0].content.includes('Tenant B'));

  // Query tenant B
  const resultsB = await knowledgeRepo.search('tenant-b', 'pricing');
  assert.equal(resultsB.length, 1);
  assert.ok(resultsB[0].content.includes('Tenant B secret pricing'));
  assert.ok(!resultsB[0].content.includes('Tenant A'));

  // Negative query: searching tenant B for tenant A terms does not return tenant A
  const crossQuery = await knowledgeRepo.search('tenant-b', 'R500');
  assert.equal(crossQuery.length, 0, 'Tenant B search must never return Tenant A rows');
});

test('2. Source filtering: Restricts retrieval to job_spec.knowledge_sources', async () => {
  const knowledgeRepo = new InMemoryCompanyKnowledgeRepository();
  await knowledgeRepo.createChunks('tenant-a', [
    { source: 'catalog.pdf', content: 'Product X price is R150.' },
    { source: 'internal_hr.pdf', content: 'Leave allowance policy: 21 days annual leave.' },
  ]);

  // Search with sourceFilter matching catalog
  const filteredCatalog = await knowledgeRepo.search('tenant-a', 'price', 3, { sourceFilter: ['catalog.pdf'] });
  assert.equal(filteredCatalog.length, 1);
  assert.equal(filteredCatalog[0].source, 'catalog.pdf');

  // Search for HR terms with catalog filter -> returns empty
  const blockedHr = await knowledgeRepo.search('tenant-a', 'leave policy', 3, { sourceFilter: ['catalog.pdf'] });
  assert.equal(blockedHr.length, 0, 'HR chunk must be excluded when sourceFilter only includes catalog.pdf');
});

test('3. Gap 3 Knowledge Hold: Customer fact query with 0 chunks holds for human review', async () => {
  const { engine, approvalRepo, queueService, taskLogRepo } = setupWorkerEngine({
    tenantId: 'tenant-a',
    jobSpec: { knowledge_sources: ['catalog.pdf'] },
  });

  // Task from an external customer asking for price quotes, with no matching knowledge in store
  const task = await queueService.enqueueTask({
    tenant_id: 'tenant-a',
    task_type: 'email_triage',
    payload: {
      from: 'customer@example.com',
      body: 'Can you please send me your pricing list and warranty terms for bulk orders?',
      subject: 'Quote inquiry',
    },
  });

  const processed = await engine.processTask(task);

  assert.equal(processed.status, TaskStatuses.AWAITING_HUMAN, 'Task must transition to AWAITING_HUMAN on knowledge hold');

  // Verify approval queue record
  const approvals = await approvalRepo.list('tenant-a');
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].action, 'knowledge.review_required');
  assert.equal(approvals[0].confidence_score, 0);
  assert.equal(approvals[0].action_payload.reason, 'no_grounding_found');
  assert.ok(approvals[0].reasoning_summary.includes('Human review required'));
});

test('4. Pass-through: Customer fact query WITH matching knowledge proceeds to execution', async () => {
  const { engine, knowledgeRepo, approvalRepo, queueService } = setupWorkerEngine({
    tenantId: 'tenant-a',
    jobSpec: { knowledge_sources: ['catalog.pdf'] },
  });

  // Seed knowledge repo with matching pricing
  await knowledgeRepo.createChunks('tenant-a', [
    { source: 'catalog.pdf', content: 'Standard pricing is R200 with 1 year warranty.' },
  ]);

  const task = await queueService.enqueueTask({
    tenant_id: 'tenant-a',
    task_type: 'email_triage',
    payload: {
      from: 'customer@example.com',
      body: 'What is the pricing and warranty terms?',
      subject: 'Pricing inquiry',
    },
  });

  const processed = await engine.processTask(task);

  assert.equal(processed.status, TaskStatuses.COMPLETED, 'Task must complete when grounding knowledge is available');
  const approvals = await approvalRepo.list('tenant-a');
  assert.equal(approvals.length, 0, 'No approval hold should be created when knowledge is found');
});

test('5. Account owner exemption: Dashboard chat asking about prices does not trigger knowledge hold', async () => {
  const { engine, approvalRepo, queueService } = setupWorkerEngine({
    tenantId: 'tenant-a',
  });

  const chatTask = await queueService.enqueueTask({
    tenant_id: 'tenant-a',
    task_type: 'chat',
    payload: {
      message: 'What is our current pricing model and rate card?',
    },
  });

  const processed = await engine.processTask(chatTask);

  assert.equal(processed.status, TaskStatuses.COMPLETED, 'Account owner chat must complete without knowledge hold');
  const approvals = await approvalRepo.list('tenant-a');
  assert.equal(approvals.length, 0, 'Account owner chat should never create knowledge review hold');
});
