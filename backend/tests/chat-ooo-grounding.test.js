/**
 * chat-ooo-grounding.test.js
 *
 * Verifies Bug 2 fix: OOO shift-hours computed in application code, not LLM.
 * Chat task_type is never schedule-gated.
 *
 * Run: node --test backend/tests/chat-ooo-grounding.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkerEngine } from '../workers/WorkerEngine.js';

function makeEngine(overrides = {}) {
  return new WorkerEngine({
    queueService: {}, sopService: {}, quotaService: {}, tenantRepository: {},
    employeeActivityLogRepository: null, employeeRepository: null,
    employeeMemoryRepository: null, companyKnowledgeRepository: null,
    embeddingService: null,
    providerRegistry: { get: () => ({ execute: async () => ({ output: { content: 'ok' } }) }) },
    workerRegistry: {}, auditService: { emit: async () => {} },
    approvalRepository: null, tenantIntegrations: null, gmailMessageService: null,
    taskChainService: null, contactRepository: null, providerUsageService: null,
    ...overrides,
  });
}

function employeeWithSchedule({ start, end } = {}) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date());
  return {
    id: 'emp-1', name: 'Test', lifecycle_status: 'active',
    schedule: { timezone: 'UTC', start: start, end: end, days: [weekday] },
    configuration: {},
  };
}

test('chat during shift: NO shift/OOO text in prompt', async () => {
  const engine = makeEngine();
  const { prompt } = await engine.assembleContextPrompt('BASE', employeeWithSchedule({ start: '00:00', end: '23:59' }), { message: 'Hello' }, 'chat');
  assert.ok(!prompt.includes('outside your scheduled'), 'No OOO text when within shift hours');
  assert.ok(!prompt.includes('INSTRUCTION: Evaluate'), 'No old OOO evaluation instruction');
  assert.ok(!prompt.includes('server time'), 'No server time in prompt when within shift');
});

test('chat outside shift hours: still NO OOO text because chat is never gated', async () => {
  const engine = makeEngine();
  const { prompt } = await engine.assembleContextPrompt('BASE', employeeWithSchedule({ start: '00:00', end: '00:01' }), { message: 'Hello' }, 'chat');
  assert.ok(!prompt.includes('outside your scheduled'), 'Chat must never be schedule-gated regardless of shift');
  assert.ok(!prompt.includes('INSTRUCTION: Evaluate'), 'Chat must not contain OOO evaluation instruction');
});

test('email_triage outside shift hours: contains OOO note', async () => {
  const engine = makeEngine();
  const { prompt } = await engine.assembleContextPrompt('BASE', employeeWithSchedule({ start: '00:00', end: '00:01' }), { message: 'email' }, 'email_triage');
  assert.ok(prompt.includes('outside your scheduled working hours'), 'Non-chat tasks outside shift must have OOO note');
});

test('email_triage within shift hours: NO OOO text', async () => {
  const engine = makeEngine();
  const { prompt } = await engine.assembleContextPrompt('BASE', employeeWithSchedule({ start: '00:00', end: '23:59' }), { message: 'email' }, 'email_triage');
  assert.ok(!prompt.includes('outside your scheduled'), 'Non-chat within shift must not have OOO text');
  assert.ok(!prompt.includes('INSTRUCTION: Evaluate'), 'No old OOO evaluation instruction when within shift');
});
