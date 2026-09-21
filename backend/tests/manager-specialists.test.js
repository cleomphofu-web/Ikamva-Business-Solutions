import { ShiftStartWorker } from '../workers/ShiftStartWorker.js';
/**
 * manager-specialists.test.js
 *
 * Tests for the Manager + Specialists architecture:
 * 1. Audience parameter enforcement and guardrails.
 * 2. Manager prompt vs End Customer prompt isolation.
 * 3. Seeded specialist activation defaults.
 * 4. Disabled specialist routing and holding replies in EmailTriageWorker.
 * 5. Manager grounding tools and specialist status reporting.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoredEmployeePrompt, VALID_AUDIENCES } from '../services/EmployeePromptService.js';
import { RepositoryFactory } from '../repositories/index.js';
import { WorkerEngine } from '../workers/WorkerEngine.js';
import { EmailTriageWorker } from '../workers/EmailTriageWorker.js';

test('EmployeePromptService: throws if audience is missing or invalid', () => {
  const emp = { name: 'Sarah', role: 'Operations' };
  assert.throws(() => buildStoredEmployeePrompt(emp), /requires an explicit valid audience/);
  assert.throws(() => buildStoredEmployeePrompt(emp, { audience: 'invalid_audience' }), /requires an explicit valid audience/);
  assert.doesNotThrow(() => buildStoredEmployeePrompt(emp, { audience: 'account_owner' }));
  assert.doesNotThrow(() => buildStoredEmployeePrompt(emp, { audience: 'end_customer' }));
  assert.doesNotThrow(() => buildStoredEmployeePrompt(emp, { audience: 'system' }));
});

test('EmployeePromptService: account_owner mode establishes Manager identity without schedule gating', () => {
  const emp = {
    name: 'Sarah',
    role: 'Operations Lead',
    configuration: { company_name: 'Acme Corp', description: 'Acme services' },
    schedule: { start: '09:00', end: '17:00', days: ['Monday'] },
  };

  const prompt = buildStoredEmployeePrompt(emp, { audience: 'account_owner' });
  assert.ok(prompt.includes('MANAGER MODE'), 'Prompt should identify Manager role');
  assert.ok(prompt.includes('speaking directly with your employer/business owner'), 'Prompt clarifies relationship');
  assert.ok(prompt.includes('NEVER apply schedule or shift-hour restrictions'), 'Manager is never schedule-gated');
  assert.ok(!prompt.includes('OUT-OF-OFFICE'), 'Manager prompt never has OOO text');
});

test('EmployeePromptService: end_customer mode protects internal details and supports OOO holding note', () => {
  const emp = {
    name: 'Sarah',
    role: 'Operations Lead',
    configuration: { company_name: 'Acme Corp' },
    schedule: { start: '09:00', end: '17:00', days: ['Monday'] },
  };

  const normalCustomerPrompt = buildStoredEmployeePrompt(emp, { audience: 'end_customer' });
  assert.ok(normalCustomerPrompt.includes('CUSTOMER-FACING'), 'Identifies customer audience');
  assert.ok(normalCustomerPrompt.includes('Never reveal internal architecture'), 'Internal details protected');
  assert.ok(!normalCustomerPrompt.includes('OUT-OF-OFFICE HOLDING NOTICE'), 'No OOO when not outside shift');

  const oooCustomerPrompt = buildStoredEmployeePrompt(emp, { audience: 'end_customer', oooPath: true });
  assert.ok(oooCustomerPrompt.includes('OUT-OF-OFFICE HOLDING NOTICE'), 'Includes OOO notice when oooPath is true');
});

test('Specialist seeding: employee activation seeds exactly 5 specialists with correct defaults', async () => {
  const factory = new RepositoryFactory({
    provider: 'memory',
    stores: {
      employees: [{ id: 'emp-1', tenant_id: 't-1', name: 'Alex', lifecycle_status: 'configuring' }],
    },
  });

  const tenantRepo = factory.forTenant('t-1');
  const activated = await tenantRepo.employees.activate('emp-1');
  assert.equal(activated.lifecycle_status, 'active');

  const specialists = await tenantRepo.specialists.listByEmployee('emp-1');
  assert.equal(specialists.length, 5, 'Must seed exactly 5 specialists');

  const sales = specialists.find(s => s.specialist_type === 'sales');
  const support = specialists.find(s => s.specialist_type === 'support');
  const crm = specialists.find(s => s.specialist_type === 'crm');
  const leadCapture = specialists.find(s => s.specialist_type === 'lead_capture');
  const dataAnalysis = specialists.find(s => s.specialist_type === 'data_analysis');

  assert.equal(sales?.enabled, true, 'Sales specialist should be enabled by default');
  assert.equal(support?.enabled, true, 'Support specialist should be enabled by default');
  assert.equal(crm?.enabled, false, 'CRM specialist disabled by default when no CRM integration connected');
  assert.equal(leadCapture?.enabled, false, 'Lead capture specialist should be disabled by default');
  assert.equal(dataAnalysis?.enabled, false, 'Data analysis specialist should be disabled by default');
  assert.equal(dataAnalysis?.config?.status, 'not_yet_available', 'Data analysis status is not_yet_available');
});

test('EmailTriageWorker: routes disabled specialist to holding reply and logs manager gap', async () => {
  let createdMemory = null;
  let enqueuedTask = null;

  const mockSpecialists = {
    findByType: async (employeeId, type) => {
      if (type === 'support') {
        return { id: 'spec-support', specialist_type: 'support', display_name: 'Customer Support Specialist', enabled: false };
      }
      return null;
    },
  };

  const mockMemories = {
    create: async (input) => { createdMemory = input; return input; },
  };

  const mockQueueService = {
    enqueueTask: async (task) => { enqueuedTask = task; return task; },
  };

  const worker = new EmailTriageWorker({
    specialistRepository: mockSpecialists,
    memoryRepository: mockMemories,
    queueService: mockQueueService,
  });

  const result = await worker.execute({
    payload: {
      credential_reference: 'cred_ref',
      message_id: 'msg_1',
      sender: 'client@example.com',
      subject: 'Help with my order',
      body: 'I need assistance',
      classification: { requires_response: true, category: 'customer_support' },
    },
    task: { id: 'task_1', tenant_id: 't-1', client_profile_id: 'cp-1' },
    employeeId: 'emp-1',
    employee: { name: 'Sarah', configuration: { company_name: 'Acme Corp' } },
    specialistRepository: mockSpecialists,
    memoryRepository: mockMemories,
    queueService: mockQueueService,
  });

  assert.equal(result.output.specialist_disabled, true);
  assert.equal(result.output.specialist_type, 'support');
  assert.ok(createdMemory, 'Disabled capability gap memory must be created for Manager');
  assert.equal(createdMemory.memory_type, 'disabled_capability_gap');
  assert.ok(enqueuedTask, 'Holding reply task must be enqueued');
  assert.ok(enqueuedTask.payload.classification.holding_reply, 'Marked as holding reply');
});

test('Live Chat Regression: chat prompt sets audience=account_owner and Manager correctly identifies user as boss', async () => {
  const factory = new RepositoryFactory({
    provider: 'memory',
    stores: {
      employees: [{
        id: 'emp-1',
        tenant_id: 't-1',
        name: 'Sarah',
        lifecycle_status: 'active',
        configuration: { company_name: 'Acme Corp', description: 'Consulting' },
      }],
      specialists: [
        { id: 'spec-1', tenant_id: 't-1', employee_id: 'emp-1', specialist_type: 'sales', display_name: 'Sales Specialist', enabled: true },
        { id: 'spec-2', tenant_id: 't-1', employee_id: 'emp-1', specialist_type: 'support', display_name: 'Customer Support Specialist', enabled: true },
      ],
      clientProfiles: [{ id: 'cp-1', tenant_id: 't-1', plan: 'pro' }],
    },
  });

  const tenantRepo = factory.forTenant('t-1');
  const engine = new WorkerEngine({
    taskQueueRepository: tenantRepo.taskQueue,
    employeeRepository: tenantRepo.employees,
    specialistRepository: tenantRepo.specialists,
    tenantRepository: {
      findClientProfileById: async () => ({ id: 'cp-1', tenant_id: 't-1', plan: 'growth' }),
    },
    workerRegistry: {
      get: () => ({
        normalizePayload: p => p,
        execute: async ({ prompt }) => {
          assert.ok(prompt.includes('MANAGER MODE'), 'Prompt must use Manager mode');
          assert.ok(prompt.includes('speaking directly with your employer/business owner'), 'Must know user is employer/boss');
          assert.ok(prompt.includes('LIVE SPECIALIST TEAM STATUS'), 'Must include team status grounding');
          return {
            output: {
              content: 'You are my employer and the account owner. My team consists of our Sales Specialist and Customer Support Specialist, both currently active and operational.',
            },
          };
        },
      }),
    },
    providerRegistry: {
      get: () => ({
        execute: async () => ({
          output: { content: 'ok' },
        }),
      }),
    },
    quotaService: { ensureWithinQuota: () => {}, getRemainingQuota: () => 100, incrementCompletedTaskCount: async () => {} },
    auditService: { emit: async () => {} },
    queueService: {
      completeTask: async (task, result) => ({ ...task, status: 'completed', output: result.output }),
      failTask: async (task, err) => ({ ...task, status: 'failed', error: err.message }),
      transitionTask: async () => {},
    },
    sopService: {
      loadActiveSOP: async () => ({ id: 'sop-chat', model_provider: 'mock', system_prompt: 'chat sop' }),
      validateInput: () => {},
      renderPrompt: () => 'fallback',
    },
  });

  const chatTask = {
    id: 'task-chat-1',
    tenant_id: 't-1',
    task_type: 'chat',
    client_profile_id: 'cp-1',
    payload: { message: "am I a customer or your boss, and how's my team doing?" },
  };

  const processed = await engine.processTask(chatTask, { workerId: 'test-worker' });
  if (processed.status !== 'completed') {
    console.error('PROCESSED ERROR:', processed.error || processed);
  }
  assert.equal(processed.status, 'completed');
  assert.ok(processed.output.content.includes('You are my employer'));
  assert.ok(processed.output.content.includes('Sales Specialist'));
});

test('Specialist toggle cycle: PATCH API updates database and immediately routes email triage to holding reply', async () => {
  const factory = new RepositoryFactory({
    provider: 'memory',
    stores: {
      employees: [{ id: 'emp-1', tenant_id: 't-1', name: 'Sarah', lifecycle_status: 'active' }],
      specialists: [
        { id: 'spec-support-1', tenant_id: 't-1', employee_id: 'emp-1', specialist_type: 'support', display_name: 'Customer Support Specialist', enabled: true },
      ],
    },
  });

  const tenantRepo = factory.forTenant('t-1');
  
  // 1. Initially enabled
  let spec = await tenantRepo.specialists.findByType('emp-1', 'support');
  assert.equal(spec.enabled, true);

  // 2. Simulate PATCH /api/v1/workforce/specialists/:id { enabled: false }
  await tenantRepo.specialists.update('spec-support-1', { enabled: false });
  spec = await tenantRepo.specialists.findByType('emp-1', 'support');
  assert.equal(spec.enabled, false);

  // 3. Triage incoming support email
  let holdingEnqueued = false;
  const triageWorker = new EmailTriageWorker({
    specialistRepository: tenantRepo.specialists,
    memoryRepository: { create: async () => {} },
    queueService: {
      enqueueTask: async (task) => {
        if (task.payload?.classification?.holding_reply) holdingEnqueued = true;
        return task;
      },
    },
  });

  const triageResult = await triageWorker.execute({
    payload: {
      credential_reference: 'cred_1',
      message_id: 'msg_1',
      sender: 'customer@example.com',
      subject: 'Urgent question',
      body: 'Need help',
      classification: { requires_response: true, category: 'customer_support' },
    },
    task: { id: 't-task-1', tenant_id: 't-1', client_profile_id: 'cp-1' },
    employeeId: 'emp-1',
    employee: { name: 'Sarah', configuration: { company_name: 'Acme Corp' } },
    specialistRepository: tenantRepo.specialists,
    memoryRepository: { create: async () => {} },
    queueService: {
      enqueueTask: async (task) => {
        if (task.payload?.classification?.holding_reply) holdingEnqueued = true;
        return task;
      },
    },
  });

  assert.equal(triageResult.output.specialist_disabled, true);
  assert.equal(holdingEnqueued, true, 'Holding reply was triggered because the toggle disabled the specialist in the DB');
});

test('Manager activity grounding: prompt contains RECENT SPECIALIST ACTIVITY with real task data when activity keywords used', async () => {
  const mockTaskQueueRepository = {
    listRecent: async (tenantId, limit) => [
      { id: 'task-aaa', task_type: 'email_triage', status: 'completed', created_at: '2026-09-15T10:00:00Z', tenant_id: 't-1' },
      { id: 'task-bbb', task_type: 'quote_generate', status: 'completed', created_at: '2026-09-15T10:05:00Z', tenant_id: 't-1' },
      { id: 'task-ccc', task_type: 'chat', status: 'processing', created_at: '2026-09-15T10:10:00Z', tenant_id: 't-1' },
    ],
  };

  let capturedPrompt = null;

  const engine = new WorkerEngine({
    taskQueueRepository: mockTaskQueueRepository,
    employeeRepository: {
      findByTenant: async () => ({
        id: 'emp-1',
        tenant_id: 't-1',
        name: 'Sarah',
        lifecycle_status: 'active',
        configuration: { company_name: 'Acme Corp', description: 'Consulting' },
      }),
    },
    specialistRepository: { listByEmployee: async () => [] },
    approvalRepository: { list: async () => [] },
    tenantRepository: {
      findClientProfileById: async () => ({ id: 'cp-1', tenant_id: 't-1', plan: 'growth' }),
    },
    workerRegistry: {
      get: () => ({
        normalizePayload: (p) => p,
        execute: async ({ prompt }) => {
          capturedPrompt = prompt;
          return { output: { content: 'Here is your activity summary.' } };
        },
      }),
    },
    providerRegistry: { get: () => ({ execute: async () => ({ output: { content: 'ok' } }) }) },
    quotaService: { ensureWithinQuota: () => {}, getRemainingQuota: () => 100, incrementCompletedTaskCount: async () => {} },
    auditService: { emit: async () => {} },
    queueService: {
      completeTask: async (task, result) => ({ ...task, status: 'completed', output: result.output }),
      failTask: async (task, err) => ({ ...task, status: 'failed', error: err.message }),
      transitionTask: async () => {},
    },
    sopService: {
      loadActiveSOP: async () => ({ id: 'sop-chat', model_provider: 'mock', system_prompt: 'chat sop', validation_schema: { required: [] } }),
      validateInput: () => {},
      renderPrompt: () => 'fallback',
    },
  });

  const chatTask = {
    id: 'task-chat-activity',
    tenant_id: 't-1',
    task_type: 'chat',
    client_profile_id: 'cp-1',
    payload: { message: 'What has there been recent activity on? What did the team do today?' },
  };

  const processed = await engine.processTask(chatTask, { workerId: 'test-worker' });
  assert.equal(processed.status, 'completed', `Task failed: ${processed.error}`);

  assert.ok(capturedPrompt, 'Worker must have received a prompt');
  assert.ok(
    capturedPrompt.includes('RECENT SPECIALIST ACTIVITY'),
    `Prompt must contain "RECENT SPECIALIST ACTIVITY" grounding block. Got:\n${capturedPrompt.slice(-600)}`
  );
  assert.ok(capturedPrompt.includes('task-aaa'), 'Prompt must include task-aaa from mock repository');
  assert.ok(capturedPrompt.includes('task-bbb'), 'Prompt must include task-bbb from mock repository');
  assert.ok(capturedPrompt.includes('email_triage'), 'Prompt must include the email_triage task type');
});

test('ShiftStartWorker: generates structured morning briefing, logs to activity, and emits SHIFT_BRIEFING_RECORDED', async () => {
  const loggedActivities = [];
  const emittedAudits = [];
  const worker = new ShiftStartWorker({ providerName: 'mock' });
  const mockSpecialists = {
    listByEmployee: async () => [
      { id: 's-1', specialist_type: 'sales', display_name: 'Sales Specialist', enabled: true },
      { id: 's-2', specialist_type: 'support', display_name: 'Support Specialist', enabled: true },
      { id: 's-3', specialist_type: 'crm', display_name: 'CRM Specialist', enabled: false },
    ],
  };
  const mockTaskQueue = {
    listRecent: async () => [
      { id: 't-1', task_type: 'email_triage', status: 'completed' },
      { id: 't-2', task_type: 'quote_generate', status: 'completed' },
    ],
  };
  const mockApprovals = {
    list: async () => [
      { id: 'a-1', task_id: 't-3', action: 'gmail.send', status: 'pending' },
    ],
  };
  const mockActivityLogs = {
    append: async (entry) => {
      loggedActivities.push(entry);
      return entry;
    },
  };
  const mockAudit = {
    emit: async (event) => {
      emittedAudits.push(event);
      return event;
    },
  };
  const mockProvider = {
    execute: async ({ prompt, payload }) => ({
      output: {
        content: 'Good morning! Sales and Support specialists are operational. 2 overnight tasks completed. 1 approval pending.',
      },
    }),
  };

  const res = await worker.execute({
    provider: mockProvider,
    payload: {},
    task: { id: 'shift-task-1', tenant_id: 't-1', client_profile_id: 'emp-1' },
    specialistRepository: mockSpecialists,
    taskQueueRepository: mockTaskQueue,
    approvalRepository: mockApprovals,
    employeeActivityLogRepository: mockActivityLogs,
    auditService: mockAudit,
    employee: { id: 'emp-1', name: 'Sarah', lifecycle_status: 'active' },
  });

  assert.equal(res.output.status, 'completed');
  assert.equal(res.output.briefing.team_summary.enabled_count, 2);
  assert.equal(res.output.briefing.team_summary.disabled_count, 1);
  assert.equal(res.output.briefing.activity_summary.completed_count, 2);
  assert.equal(res.output.briefing.approvals_summary.pending_count, 1);
  assert.equal(loggedActivities.length, 1, 'Must write morning briefing to activity log');
  assert.equal(loggedActivities[0].action, 'morning_briefing_generated');
  assert.equal(emittedAudits.length, 1, 'Must emit audit event');
  assert.equal(emittedAudits[0].eventType, 'SHIFT_BRIEFING_RECORDED');
});
