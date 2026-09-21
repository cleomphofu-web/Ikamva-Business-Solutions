import test from 'node:test';
import assert from 'node:assert/strict';
import { QueueService } from '../services/QueueService.js';

test('concurrent triage enqueue attempts produce one task and one creation audit', async () => {
  const seen = new Set();
  const tasks = [];
  const queueRepository = {
    async enqueueEmailTriageTask(input) {
      await new Promise(resolve => setTimeout(resolve, 1));
      const key = `${input.tenant_id}:${input.message_id}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const task = { id: `task-${tasks.length + 1}`, tenant_id: input.tenant_id, task_type: 'email_triage', status: 'pending', idempotency_key: input.idempotency_key };
      tasks.push(task);
      return task;
    },
  };
  const events = [];
  const queue = new QueueService({ taskQueueRepository: queueRepository, auditService: { emit: async event => events.push(event) } });
  const input = { tenant_id: 'tenant-a', message_id: 'gmail-message-1', idempotency_key: 'email_triage_gmail-message-1', payload: {} };
  const results = await Promise.all([queue.enqueueEmailTriageTask(input), queue.enqueueEmailTriageTask(input)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(tasks.length, 1);
  assert.equal(events.filter(event => event.eventType === 'TASK_CREATED').length, 1);
});
