import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTaskQueueRepository } from '../repositories/InMemoryTaskQueueRepository.js';
import { QueueService } from '../services/QueueService.js';
import { TaskChainService } from '../services/TaskChainService.js';

function setup() {
  const repository = new InMemoryTaskQueueRepository();
  const events = [];
  const auditService = { emit: async event => events.push(event) };
  const queueService = new QueueService({ taskQueueRepository: repository, auditService });
  return { repository, events, service: new TaskChainService({ queueService, taskQueueRepository: repository, auditService }) };
}

const config = { steps: [
  { name: 'first', task_type: 'step_one', required: true },
  { name: 'optional', task_type: 'step_two', required: false },
  { name: 'final', task_type: 'step_three', required: true },
] };

test('TaskChainService creates a parent and first child, then advances in order', async () => {
  const { repository, service } = setup();
  const created = await service.createChain('tenant-1', 'employee-1', config, { input: 'value' });
  const parent = await repository.findById(created.parentTaskId);
  const first = await repository.findById(created.firstStepTaskId);
  assert.equal(parent.chain_config.steps.length, 3);
  assert.equal(parent.status, 'pending');
  assert.equal(first.parent_task_id, parent.id);
  const second = await service.advanceChain(first.id, { extracted: true });
  assert.equal(second.step_index, 1);
  assert.deepEqual(second.payload.previous_result, { extracted: true });
  const status = await service.getChainStatus(parent.id);
  assert.deepEqual(status.steps.map(step => step.step_name), ['first', 'optional']);
});

test('TaskChainService sets specialist_id from specialistRepository and assigns to parent and child', async () => {
  const repository = new InMemoryTaskQueueRepository();
  const queueService = new QueueService({ taskQueueRepository: repository, auditService: { emit: async () => {} } });
  const mockSpecialistRepo = {
    findByType: async (_tenantId, _employeeId, type) => ({ id: `spec-${type}`, specialist_type: type, enabled: true }),
  };
  const service = new TaskChainService({
    queueService,
    taskQueueRepository: repository,
    auditService: { emit: async () => {} },
    specialistRepository: mockSpecialistRepo,
  });

  const quoteConfig = { steps: [{ name: 'quote_step', task_type: 'quote_generate' }] };
  const created = await service.createChain('tenant-1', 'emp-1', quoteConfig, { dealId: 123 });
  const parent = await repository.findById(created.parentTaskId);
  const first = await repository.findById(created.firstStepTaskId);

  assert.equal(parent.specialist_id, 'spec-sales');
  assert.equal(first.specialist_id, 'spec-sales');
});

test('TaskChainService sends holding reply and logs attempt when specialist is disabled', async () => {
  const repository = new InMemoryTaskQueueRepository();
  const queueService = new QueueService({ taskQueueRepository: repository, auditService: { emit: async () => {} } });
  const mockSpecialistRepo = {
    findByType: async () => ({ id: 'spec-sales', specialist_type: 'sales', enabled: false }),
  };
  let loggedAttempt = null;
  const mockTaskLogRepo = {
    create: async (entry) => { loggedAttempt = entry; return entry; },
  };

  const service = new TaskChainService({
    queueService,
    taskQueueRepository: repository,
    auditService: { emit: async () => {} },
    specialistRepository: mockSpecialistRepo,
    taskLogRepository: mockTaskLogRepo,
    employeeRepository: { findById: async () => ({ id: 'emp-1', name: 'Sarah' }) },
  });

  const quoteConfig = { steps: [{ name: 'quote_step', task_type: 'quote_generate' }] };
  const res = await service.createChain('tenant-1', 'emp-1', quoteConfig, { emailId: 'msg-99', tenantId: 'tenant-1', employeeId: 'emp-1' });

  assert.equal(res.status, 'holding_reply_sent');
  assert.equal(res.specialistType, 'sales');
  assert.ok(loggedAttempt);
  assert.equal(loggedAttempt.type, 'disabled_specialist_attempt');
  assert.equal(loggedAttempt.specialist_type, 'sales');

  const enqueued = await repository.listRecent('tenant-1');
  const holdingTask = enqueued.find(t => t.task_type === 'email_response');
  assert.ok(holdingTask);
  assert.equal(holdingTask.payload.isHoldingReply, true);
  assert.ok(holdingTask.payload.response.includes('Sarah'));
});

test('TaskChainService fails the parent and writes CHAIN_FAILED metadata', async () => {
  const { repository, service, events } = setup();
  const created = await service.createChain('tenant-1', 'employee-1', config, {});
  const error = new Error('step failed');
  await service.failChain(created.firstStepTaskId, error);
  assert.equal((await repository.findById(created.parentTaskId)).status, 'failed');
  const event = events.find(item => item.eventType === 'CHAIN_FAILED');
  assert.deepEqual(event.metadata, { stepIndex: 0, stepName: 'first', error: 'step failed' });
});

test('WorkerEngine advanceChain regression: passes completed child task.id and advances chain correctly', async () => {
  let advanceCalledWithId = null;
  let advanceCalledWithResult = null;

  const mockTaskChainService = {
    advanceChain: async (taskId, result) => {
      advanceCalledWithId = taskId;
      advanceCalledWithResult = result;
    },
    failChain: async () => {},
  };

  const { WorkerEngine } = await import('../workers/WorkerEngine.js');
  const engine = new WorkerEngine({
    taskChainService: mockTaskChainService,
    taskQueueRepository: {
      updateStatus: async () => {},
      listRecent: async () => [],
      findById: async (id) => ({
        id,
        parent_task_id: 'parent-chain-task-1',
        step_index: 0,
        step_name: 'email_read',
        task_type: 'email_read',
        tenant_id: 'tenant-1',
        client_profile_id: 'cp-1',
        status: 'pending',
        payload: {},
      }),
    },
    employeeRepository: {
      findByTenant: async () => ({
        id: 'emp-1',
        lifecycle_status: 'active',
        configuration: { skills: ['email_management', 'quotes_and_invoicing', 'crm'] },
      }),
    },

    tenantRepository: { findClientProfileById: async () => ({ id: 'cp-1', plan: 'growth', monthly_task_limit: 1000 }) },
    quotaService: { ensureWithinQuota: () => 100, getRemainingQuota: () => 100, incrementCompletedTaskCount: async () => {} },
    auditService: { emit: async () => {} },
    queueService: {
      completeTask: async (task, result) => ({ ...task, status: 'completed', output: result.output }),
      transitionTask: async () => {},
      failTask: async (task, err) => ({ ...task, status: 'failed', error: err.message }),
    },
    sopService: {
      loadActiveSOP: async () => ({ id: 'sop-step', model_provider: 'mock', system_prompt: 'step sop', validation_schema: { required: [] } }),
      validateInput: () => {},
      renderPrompt: () => 'fallback',
    },
    workerRegistry: {
      get: () => ({
        normalizePayload: p => p,
        execute: async () => ({ output: { content: 'done', chain_context: { quote_id: 'q-101' } } }),
      }),
    },
    providerRegistry: { get: () => ({ execute: async () => ({ output: { content: 'ok' } }) }) },
  });

  const childTask = {
    id: 'child-step-task-99',
    parent_task_id: 'parent-chain-task-1',
    tenant_id: 'tenant-1',
    task_type: 'email_read',
    client_profile_id: 'cp-1',
    step_index: 0,
    step_name: 'email_read',
    payload: {},
  };

  const processed = await engine.processTask(childTask, { workerId: 'test-worker' });
  assert.equal(processed.status, 'completed');
  assert.equal(
    advanceCalledWithId,
    'child-step-task-99',
    'WorkerEngine MUST call advanceChain with the completed child task ID (task.id), not task.parent_task_id'
  );
  assert.deepEqual(advanceCalledWithResult, { quote_id: 'q-101' });
});


