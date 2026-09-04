import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSkillId, planIncludesSkill, requiredSkillForTask } from '../config/skill-plans.js';
import { WorkerEngine } from '../workers/WorkerEngine.js';

function enforcementEngine(profile, employee) {
  let transition;
  const engine = new WorkerEngine({
    queueService: { transitionTask: async (_task, status, options) => { transition = { status, ...options }; return transition; } },
    sopService: { loadActiveSOP: async () => ({ id: 'sop-1' }), validateInput() {}, renderPrompt: () => 'fallback' },
    quotaService: { ensureWithinQuota() {}, getRemainingQuota: () => 1 },
    tenantRepository: { findClientProfileById: async () => profile },
    employeeRepository: { findByTenant: async () => employee },
    auditService: { emit: async () => {} },
    workerRegistry: { get: () => ({ normalizePayload: payload => payload, execute: async () => { throw new Error('provider should not run'); } }) },
    providerRegistry: { get: () => { throw new Error('provider should not be selected'); } },
  });
  return { engine, getTransition: () => transition };
}

test('skill plan rejects an unentitled capability with PLAN_LIMIT semantics', () => {
  const required = requiredSkillForTask('email_response', {});
  assert.equal(required, 'email_management');
  assert.equal(planIncludesSkill('starter', required), false);
});

test('skill plan recognizes the configured UI alias for an enabled capability', () => {
  assert.equal(canonicalSkillId('email'), 'email_management');
  assert.equal(planIncludesSkill('growth', canonicalSkillId('email')), true);
});

test('skill plan keeps disabled skills distinct from plan entitlement', () => {
  assert.equal(planIncludesSkill('growth', 'email_management'), true);
  assert.equal(canonicalSkillId('email'), 'email_management');
});

test('WorkerEngine rejects an unentitled task before provider execution', async () => {
  const { engine, getTransition } = enforcementEngine({ plan: 'starter' }, { configuration: { skills: ['email'] } });
  await engine.processTask({ id: 'task-1', tenant_id: 'tenant-1', client_profile_id: 'client-1', task_type: 'email_response', payload: {} });
  assert.equal(getTransition().metadata.code, 'PLAN_LIMIT');
  assert.equal(getTransition().message, 'This skill requires a higher plan');
});

test('WorkerEngine rejects a disabled task even when the plan includes it', async () => {
  const { engine, getTransition } = enforcementEngine({ plan: 'growth' }, { configuration: { skills: [] } });
  await engine.processTask({ id: 'task-2', tenant_id: 'tenant-1', client_profile_id: 'client-1', task_type: 'email_response', payload: {} });
  assert.equal(getTransition().metadata.code, 'SKILL_DISABLED');
  assert.equal(getTransition().message, 'This skill is disabled for the Employee');
});
