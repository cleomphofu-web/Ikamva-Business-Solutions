/**
 * Gmail Dispatch Verification & Dry-Run Tests
 * ============================================
 * Required complete sequence on approval:
 * TASK_CREATED -> WORKER_STARTED -> VALIDATION_STARTED -> VALIDATION_COMPLETED ->
 * QUOTA_APPROVED -> AI_REQUESTED -> AI_COMPLETED -> AWAITING_HUMAN ->
 * HUMAN_APPROVED -> GMAIL_SENT -> TASK_COMPLETED
 *
 * Required sequence on rejection:
 * AWAITING_HUMAN -> HUMAN_REJECTED -> TASK_COMPLETED
 */

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
import { TaskStatuses, TaskEvents } from '../domain/task-events.js';

// --- Shared Test Provider with mock sendWithCredential ------------------------

class TestableGmailMCPProvider extends GmailMCPProvider {
  constructor(options = {}) {
    super(options);
    this.sentCalls = [];
  }

  async sendWithCredential({ payload, credentialReference }) {
    if (!credentialReference) throw new Error('Gmail send requires a credential_reference.');
    this.sentCalls.push({ payload, credentialReference });
    return {
      provider:   this.name,
      message_id: 'mock-gmail-msg-123',
      thread_id:  'mock-gmail-thd-456',
      recipient:  payload.to,
      subject:    payload.subject,
    };
  }
}

// --- In-Memory Approval Test Repo Helper ------------------------------------

class MockApprovalRepository {
  constructor() {
    this.store = [];
  }
  async list(tenantId) {
    return this.store.filter(x => x.tenant_id === tenantId);
  }
  async create(input) {
    const row = {
      id: `approval-${this.store.length + 1}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      ...input,
    };
    this.store.push(row);
    return { ...row };
  }
  async findById(tenantId, id) {
    return this.store.find(x => x.tenant_id === tenantId && x.id === id) || null;
  }
  async findByTaskId(tenantId, taskId) {
    return this.store.find(x => x.tenant_id === tenantId && x.task_id === taskId) || null;
  }
  async updateStatus(tenantId, id, status, reviewedBy = null, reviewNote = null) {
    const row = await this.findById(tenantId, id);
    if (!row) return null;
    Object.assign(row, { status, reviewed_by: reviewedBy, review_note: reviewNote });
    return { ...row };
  }
}

function buildStack({ customGmailProvider } = {}) {
  const taskQueueRepository = new InMemoryTaskQueueRepository();
  const taskLogRepository   = new InMemoryTaskLogRepository();
  const approvalRepository  = new MockApprovalRepository();
  const auditService        = new AuditService({ taskLogRepository });
  const queueService        = new QueueService({ taskQueueRepository, auditService });
  const gmailProvider       = customGmailProvider || new TestableGmailMCPProvider({ oauthEnabled: false });

  const providers = new ProviderRegistry();
  providers.register('gmail-mcp', gmailProvider);

  const engine = new WorkerEngine({
    queueService,
    auditService,
    approvalRepository,
    providerRegistry: providers,
    workerRegistry: { get: () => new EmailWorker({ providerName: 'gmail-mcp' }) },
    sopService: {
      loadActiveSOP:  async () => ({ id: 'sop-email-1', model_provider: 'gmail-mcp' }),
      validateInput:  () => {},
      renderPrompt:   () => 'Draft a follow-up email to test@example.com',
    },
    quotaService: {
      ensureWithinQuota:           () => {},
      getRemainingQuota:           () => 99,
      incrementCompletedTaskCount: async () => {},
    },
    tenantRepository: {
      findClientProfileById: async () => ({ id: 'client-a', tenant_id: 'tenant-a', tasks_used: 0, plan_tasks_limit: 100 }),
    },
  });

  return {
    taskQueueRepository,
    taskLogRepository,
    approvalRepository,
    auditService,
    queueService,
    engine,
    gmailProvider,
  };
}

function getLogs(taskLogRepository, taskId) {
  return [...taskLogRepository.logs].filter(l => l.task_id === taskId);
}

// --- Step 1 + 2: Task lands in awaiting_human and populates approval_queue ---

test('STEP 1-2 | Email SOP task lands in awaiting_human and creates approval_queue row', async () => {
  const { taskQueueRepository, taskLogRepository, approvalRepository, queueService, engine } = buildStack();

  const task = await queueService.enqueueTask({
    tenant_id:         'tenant-a',
    client_profile_id: 'client-a',
    task_type:         'email',
    payload: {
      to:      'test@example.com',
      subject: 'Follow-up from Ikamva',
      text:    'Hi, just following up on our conversation.',
    },
    idempotency_key: 'dryrun-email-step1',
    scheduled_for:   new Date().toISOString(),
  });

  const claimed = await queueService.claimNextTask({ tenantId: 'tenant-a', workerId: 'dryrun-worker' });
  await engine.processTask(claimed, { workerId: 'dryrun-worker' });

  const finalTask = await taskQueueRepository.findById(task.id);
  assert.equal(finalTask.status, TaskStatuses.AWAITING_HUMAN);

  const approvalRow = await approvalRepository.findByTaskId('tenant-a', task.id);
  assert.ok(approvalRow, 'approval_queue row must be created');
  assert.equal(approvalRow.action, 'gmail.send');
  assert.equal(approvalRow.action_payload.to, 'test@example.com');
  assert.equal(approvalRow.action_payload.subject, 'Follow-up from Ikamva');

  const events = getLogs(taskLogRepository, task.id).map(l => l.metadata.event_type);
  assert.ok(events.includes(TaskEvents.AWAITING_HUMAN));
});

// --- Step 3 & 4: Full E2E Human Approval Sequence ---------------------------

test('STEP 3-4 | Full Approval Sequence: HUMAN_APPROVED -> GMAIL_SENT -> TASK_COMPLETED', async () => {
  const { taskQueueRepository, taskLogRepository, approvalRepository, queueService, engine, gmailProvider } = buildStack();

  const task = await queueService.enqueueTask({
    tenant_id:         'tenant-a',
    client_profile_id: 'client-a',
    task_type:         'email',
    payload: {
      to:      'test@example.com',
      subject: 'E2E Full Sequence',
      text:    'Checking the entire audit sequence.',
    },
    idempotency_key: 'dryrun-email-full',
    scheduled_for:   new Date().toISOString(),
  });

  const claimed = await queueService.claimNextTask({ tenantId: 'tenant-a', workerId: 'dryrun-worker' });
  await engine.processTask(claimed, { workerId: 'dryrun-worker' });

  const approvalRow = await approvalRepository.findByTaskId('tenant-a', task.id);
  assert.ok(approvalRow);

  // Simulate human approving
  await engine.resumeApprovedTask(claimed, approvalRow, {
    reviewedBy:          'user-admin-1',
    credentialReference: 'mock-encrypted-token-v1',
  });

  const completed = await taskQueueRepository.findById(task.id);
  assert.equal(completed.status, TaskStatuses.COMPLETED);

  assert.equal(gmailProvider.sentCalls.length, 1);
  assert.equal(gmailProvider.sentCalls[0].payload.to, 'test@example.com');

  const logs = getLogs(taskLogRepository, task.id);
  const events = logs.map(l => l.metadata.event_type);

  const expected = [
    TaskEvents.TASK_CREATED,
    TaskEvents.WORKER_STARTED,
    TaskEvents.VALIDATION_STARTED,
    TaskEvents.VALIDATION_COMPLETED,
    TaskEvents.QUOTA_APPROVED,
    TaskEvents.AI_REQUESTED,
    TaskEvents.AI_COMPLETED,
    TaskEvents.AWAITING_HUMAN,
    TaskEvents.HUMAN_APPROVED,
    TaskEvents.GMAIL_SENT,
    TaskEvents.TASK_COMPLETED,
  ];

  assert.deepEqual(
    events,
    expected,
    `Audit sequence mismatch.\nExpected: ${expected.join(' -> ')}\nGot:      ${events.join(' -> ')}`
  );

  const gmailSentLog = logs.find(l => l.metadata.event_type === TaskEvents.GMAIL_SENT);
  assert.equal(gmailSentLog.metadata.recipient, 'test@example.com');
  assert.equal(gmailSentLog.metadata.subject, 'E2E Full Sequence');
  assert.ok(gmailSentLog.metadata.preview);
  assert.equal(gmailSentLog.metadata.credentialReference, undefined, 'Must never log credentials');
});

// --- Human Rejection Sequence -----------------------------------------------

test('REJECTION | HUMAN_REJECTED -> TASK_COMPLETED', async () => {
  const { taskQueueRepository, taskLogRepository, approvalRepository, queueService, engine, gmailProvider } = buildStack();

  const task = await queueService.enqueueTask({
    tenant_id:         'tenant-a',
    client_profile_id: 'client-a',
    task_type:         'email',
    payload: {
      to:      'unwanted@example.com',
      subject: 'Reject me',
      text:    'Do not send this.',
    },
    idempotency_key: 'dryrun-email-reject',
    scheduled_for:   new Date().toISOString(),
  });

  const claimed = await queueService.claimNextTask({ tenantId: 'tenant-a', workerId: 'dryrun-worker' });
  await engine.processTask(claimed, { workerId: 'dryrun-worker' });

  const approvalRow = await approvalRepository.findByTaskId('tenant-a', task.id);
  assert.ok(approvalRow);

  // Simulate human rejecting
  await engine.rejectTask(claimed, approvalRow, {
    reviewedBy: 'user-admin-1',
    reviewNote: 'Sender not recognized',
  });

  const completed = await taskQueueRepository.findById(task.id);
  assert.equal(completed.status, TaskStatuses.COMPLETED);
  assert.equal(gmailProvider.sentCalls.length, 0, 'No email must be sent on rejection');

  const logs = getLogs(taskLogRepository, task.id);
  const events = logs.map(l => l.metadata.event_type);

  const expected = [
    TaskEvents.TASK_CREATED,
    TaskEvents.WORKER_STARTED,
    TaskEvents.VALIDATION_STARTED,
    TaskEvents.VALIDATION_COMPLETED,
    TaskEvents.QUOTA_APPROVED,
    TaskEvents.AI_REQUESTED,
    TaskEvents.AI_COMPLETED,
    TaskEvents.AWAITING_HUMAN,
    TaskEvents.HUMAN_REJECTED,
    TaskEvents.TASK_COMPLETED,
  ];

  assert.deepEqual(events, expected);

  const rejectionLog = logs.find(l => l.metadata.event_type === TaskEvents.HUMAN_REJECTED);
  assert.equal(rejectionLog.metadata.review_note, 'Sender not recognized');
});
