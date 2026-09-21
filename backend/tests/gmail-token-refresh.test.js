import test from 'node:test';
import assert from 'node:assert/strict';
import { GmailMessageService } from '../services/GmailMessageService.js';
import { encryptRefreshToken, decryptRefreshToken } from '../services/GmailOAuthService.js';
import { IntegrationError } from '../lib/errors.js';

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

const originalFetch = global.fetch;
test.afterEach(() => { global.fetch = originalFetch; });

test('uses a non-expired stored access token without refreshing', async () => {
  let refreshCalls = 0;
  global.fetch = async () => { refreshCalls += 1; throw new Error('should not refresh'); };
  const service = new GmailMessageService({ tenantIntegrations: {
    findByProvider: async () => ({ access_token_encrypted: encryptRefreshToken('cached-access'), access_token_expires_at: new Date(Date.now() + 3600000).toISOString() }),
  } });
  assert.equal(await service.token(encryptRefreshToken('refresh'), { tenantId: 'tenant-1' }), 'cached-access');
  assert.equal(refreshCalls, 0);
});

test('refreshes expired access tokens and persists encrypted metadata', async () => {
  let saved;
  global.fetch = async () => ({ ok: true, json: async () => ({ access_token: 'fresh-access', expires_in: 3600 }) });
  const service = new GmailMessageService({ tenantIntegrations: {
    findByProvider: async () => ({ access_token_expires_at: new Date(Date.now() - 1000).toISOString() }),
    upsert: async (tenantId, fields) => { saved = { tenantId, fields }; },
  } });
  assert.equal(await service.token(encryptRefreshToken('refresh'), { tenantId: 'tenant-1' }), 'fresh-access');
  assert.equal(saved.tenantId, 'tenant-1');
  assert.equal(decryptRefreshToken(saved.fields.access_token_encrypted), 'fresh-access');
  assert.equal(saved.fields.provider, 'gmail');
});

test('disconnects and raises IntegrationError when refresh is rejected', async () => {
  let disconnected;
  global.fetch = async () => ({ ok: false, json: async () => ({ error_description: 'invalid_grant' }) });
  const service = new GmailMessageService({ tenantIntegrations: {
    findByProvider: async () => null,
    disconnect: async (...args) => { disconnected = args; },
  } });
  await assert.rejects(() => service.token(encryptRefreshToken('refresh'), { tenantId: 'tenant-1' }), error => error instanceof IntegrationError && error.code === 'INTEGRATION_ERROR');
  assert.deepEqual(disconnected, ['tenant-1', 'gmail']);
});

test('draft lookup distinguishes an existing draft from a deleted draft', async () => {
  process.env.MOCK_GMAIL = 'true';
  const service = new GmailMessageService();
  const created = await service.createDraft('unused', { raw: 'draft', threadId: 'thread-1' });
  assert.ok(await service.getDraft('unused', created.id));
  await service.deleteDraft('unused', created.id);
  assert.equal(await service.getDraft('unused', created.id), null);
  delete process.env.MOCK_GMAIL;
});
