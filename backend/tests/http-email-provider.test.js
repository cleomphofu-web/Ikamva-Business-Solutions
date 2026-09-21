import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpEmailProvider } from '../providers/HttpEmailProvider.js';

test('HttpEmailProvider sends the provider-neutral email contract', async () => {
  let request;
  const provider = new HttpEmailProvider({
    endpoint: 'https://api.resend.com/emails',
    apiKey: 'secret',
    from: 'Ikamva <noreply@example.com>',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 202, json: async () => ({ message_id: 'm-1' }) };
    },
  });
  const result = await provider.send({ to: 'client@example.com', subject: 'Hello', text: 'Welcome' });

  assert.equal(result.provider, 'http-email');
  assert.equal(result.message_id, 'm-1');
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(request.options.body), {
    from: 'Ikamva <noreply@example.com>', to: 'client@example.com', subject: 'Hello', text: 'Welcome', metadata: {},
  });
});

test('HttpEmailProvider reports delivery failures without leaking the API key', async () => {
  const provider = new HttpEmailProvider({
    endpoint: 'https://api.resend.com/emails',
    apiKey: 'secret',
    from: 'Ikamva <noreply@example.com>',
    fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'temporarily unavailable' }),
  });
  await assert.rejects(() => provider.send({ to: 'client@example.com', subject: 'Hello', text: 'Welcome' }), /503/);
});
