/**
 * gmail-watch.test.js
 *
 * Unit tests for GmailWatchService.
 * All Gmail API calls are mocked — no network required.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GmailWatchService } from '../services/GmailWatchService.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGmailMessageService(overrides = {}) {
  return {
    watch: async () => ({ historyId: '12345', expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000) }),
    stopWatch: async () => null,
    listHistory: async () => [],
    ...overrides,
  };
}

function makeTenantIntegrations(integration = {}) {
  let stored = { provider: 'gmail', status: 'connected', ...integration };
  return {
    upsertCalls: [],
    upsert(fields) { this.upsertCalls.push(fields); stored = { ...stored, ...fields }; return Promise.resolve(stored); },
    findByProvider() { return Promise.resolve(stored); },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('registerWatch calls gmail.watch with the configured topic and persists push metadata', async () => {
  const gmailMessageService = makeGmailMessageService();
  const tenantIntegrations = makeTenantIntegrations();
  const service = new GmailWatchService({
    gmailMessageService,
    tenantIntegrations,
    topicName: 'projects/test-project/topics/gmail-push',
  });

  const result = await service.registerWatch('ref-123', 'tenant-abc');

  assert.equal(result.historyId, '12345');
  assert.ok(tenantIntegrations.upsertCalls.length >= 1, 'upsert should have been called');
  const upserted = tenantIntegrations.upsertCalls[0];
  assert.equal(upserted.provider, 'gmail');
  assert.ok(upserted.push_expiry, 'push_expiry must be set');
  assert.ok(typeof upserted.push_history_id === 'number', 'push_history_id must be a number');
  assert.equal(upserted.push_history_id, 12345);
});

test('registerWatch throws when PUBSUB_TOPIC is not configured', async () => {
  const service = new GmailWatchService({
    gmailMessageService: makeGmailMessageService(),
    tenantIntegrations: makeTenantIntegrations(),
    topicName: null,
  });

  await assert.rejects(
    () => service.registerWatch('ref', 'tenant'),
    /PUBSUB_TOPIC is not configured/,
  );
});

test('renewWatchIfNeeded skips when push_expiry is more than 24h away', async () => {
  let registerWatchCalled = false;
  const service = new GmailWatchService({
    gmailMessageService: makeGmailMessageService({
      watch: async () => { registerWatchCalled = true; return { historyId: '999', expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000) }; },
    }),
    tenantIntegrations: makeTenantIntegrations(),
    topicName: 'projects/test/topics/push',
  });

  const farFuture = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const integration = { push_expiry: farFuture, credential_reference: 'ref' };
  const renewed = await service.renewWatchIfNeeded(integration, 'ref', 'tenant-xyz');

  assert.equal(renewed, false, 'should not renew when expiry is far away');
  assert.equal(registerWatchCalled, false);
});

test('renewWatchIfNeeded renews when push_expiry is within 24h', async () => {
  let registerWatchCalled = false;
  const service = new GmailWatchService({
    gmailMessageService: makeGmailMessageService({
      watch: async () => { registerWatchCalled = true; return { historyId: '888', expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000) }; },
    }),
    tenantIntegrations: makeTenantIntegrations(),
    topicName: 'projects/test/topics/push',
  });

  const nearExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // 12h away
  const integration = { push_expiry: nearExpiry, credential_reference: 'ref' };
  const renewed = await service.renewWatchIfNeeded(integration, 'ref', 'tenant-xyz');

  assert.equal(renewed, true, 'should renew when within 24h of expiry');
  assert.equal(registerWatchCalled, true);
});

test('renewWatchIfNeeded renews when push_expiry is null (never registered)', async () => {
  let registerWatchCalled = false;
  const service = new GmailWatchService({
    gmailMessageService: makeGmailMessageService({
      watch: async () => { registerWatchCalled = true; return { historyId: '777', expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000) }; },
    }),
    tenantIntegrations: makeTenantIntegrations(),
    topicName: 'projects/test/topics/push',
  });

  const renewed = await service.renewWatchIfNeeded({ push_expiry: null }, 'ref', 'tenant-xyz');
  assert.equal(renewed, true);
  assert.equal(registerWatchCalled, true);
});

test('renewWatchIfNeeded returns false and does not throw when PUBSUB_TOPIC is null', async () => {
  const service = new GmailWatchService({
    gmailMessageService: makeGmailMessageService(),
    tenantIntegrations: makeTenantIntegrations(),
    topicName: null,
  });

  const renewed = await service.renewWatchIfNeeded({ push_expiry: null }, 'ref', 'tenant');
  assert.equal(renewed, false);
});

test('stopWatch calls gmail.stopWatch and clears push columns', async () => {
  let stopWatchCalled = false;
  const tenantIntegrations = makeTenantIntegrations({ push_expiry: '2099-01-01T00:00:00Z', push_history_id: 999 });
  const service = new GmailWatchService({
    gmailMessageService: makeGmailMessageService({
      stopWatch: async () => { stopWatchCalled = true; return null; },
    }),
    tenantIntegrations,
    topicName: 'projects/test/topics/push',
  });

  await service.stopWatch('ref', 'tenant');
  assert.equal(stopWatchCalled, true);
  const cleared = tenantIntegrations.upsertCalls.find(c => c.push_expiry === null);
  assert.ok(cleared, 'push_expiry should be cleared');
  assert.strictEqual(cleared.push_history_id, null);
});

test('listNewMessages returns empty array when startHistoryId is falsy', async () => {
  const service = new GmailWatchService({
    gmailMessageService: makeGmailMessageService(),
    tenantIntegrations: makeTenantIntegrations(),
    topicName: 'projects/test/topics/push',
  });

  const result = await service.listNewMessages('ref', 'tenant', null);
  assert.deepEqual(result, []);
});

test('listNewMessages delegates to gmail.listHistory and returns message array', async () => {
  const service = new GmailWatchService({
    gmailMessageService: makeGmailMessageService({
      listHistory: async ({ startHistoryId }) => {
        assert.equal(startHistoryId, 5001);
        return [
          { messageId: 'msg-a', threadId: 'thread-1' },
          { messageId: 'msg-b', threadId: 'thread-1' },
        ];
      },
    }),
    tenantIntegrations: makeTenantIntegrations(),
    topicName: 'projects/test/topics/push',
  });

  const result = await service.listNewMessages('ref', 'tenant', 5001);
  assert.equal(result.length, 2);
  assert.equal(result[0].messageId, 'msg-a');
  assert.equal(result[1].messageId, 'msg-b');
});
