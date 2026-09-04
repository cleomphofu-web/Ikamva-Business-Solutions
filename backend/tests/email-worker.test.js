import test from 'node:test';
import assert from 'node:assert/strict';
import { EmailWorker, sanitizeEmailBody } from '../workers/EmailWorker.js';
import { MockEmailProvider } from '../providers/MockEmailProvider.js';

test('EmailWorker normalizes and sends through the provider contract', async () => {
  const worker = new EmailWorker();
  const provider = new MockEmailProvider({ clock: () => new Date('2026-08-25T10:00:00.000Z') });
  const payload = worker.normalizePayload({
    to: ' Client@Example.com ',
    subject: ' Welcome ',
    text: 'Hello from Ikamva.',
  });
  const result = await worker.execute({ provider, payload, task: { id: 'task-1' } });

  assert.equal(result.status, 'accepted');
  assert.equal(result.to, 'client@example.com');
  assert.equal(result.metadata.task_id, 'task-1');
});

test('EmailWorker rejects incomplete messages', () => {
  const worker = new EmailWorker();
  assert.throws(() => worker.normalizePayload({ subject: 'Missing recipient', text: 'Hello' }), /recipient/);
  assert.throws(() => worker.normalizePayload({ to: 'client@example.com', text: 'Missing subject' }), /subject/);
  assert.throws(() => worker.normalizePayload({ to: 'client@example.com', subject: 42, text: 'Body' }), /subject must be a string/);
  assert.throws(() => worker.normalizePayload({ to: 'client@example.com', subject: 'Subject', body: { text: 'Body' } }), /body must be a string/);
});

test('EmailWorker sanitizes AI email formatting before dispatch', async () => {
  const body = sanitizeEmailBody('Here is the email draft:\n# Update\n\n| Item | Status |\n| --- | --- |\n| Review | Complete |\n\n**Hello John,**\n- The review is complete.\n\nRegards,\nAmina');
  assert.equal(body.includes('|'), false);
  assert.equal(body.includes('# Update'), false);
  assert.equal(body.includes('**'), false);
  assert.equal(body.startsWith('Here is'), false);
  assert.match(body, /Hello John/);
  assert.match(body, /Regards/);
});
