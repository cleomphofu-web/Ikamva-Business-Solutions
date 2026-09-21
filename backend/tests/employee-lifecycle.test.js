import test from 'node:test';
import assert from 'node:assert/strict';
import { EmailTriageScheduler } from '../services/EmailTriageScheduler.js';

test('triage scheduler only enqueues active Employees', async () => {
  let enqueued = 0;
  const scheduler = new EmailTriageScheduler({
    tenantRepository: {},
    employeeRepository: { findByTenant: async () => ({ lifecycle_status: 'draft' }) },
    integrationRepository: { findByProvider: async () => ({ status: 'connected', credential_reference: 'x' }) },
    queueService: { enqueueTask: async () => { enqueued += 1; } },
  });
  assert.equal(await scheduler.enqueueForTenant('tenant-a'), null);
  assert.equal(enqueued, 0);
});
