import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { InMemoryTenantRepository } from '../repositories/InMemoryTenantRepository.js';
import { SupabaseTenantRepository } from '../repositories/providers/SupabaseTenantRepository.js';

test('InMemoryTenantRepository: validates raw token against stored SHA-256 hash using constant-time comparison', async () => {
  const rawSecret = 'sekret-webhook-token-12345';
  const hashedSecret = crypto.createHash('sha256').update(rawSecret).digest('hex');

  const repo = new InMemoryTenantRepository([
    {
      id: 'tenant-a',
      company_name: 'Acme Corp',
      webhook_token: hashedSecret,
    },
    {
      id: 'tenant-b',
      company_name: 'Beta LLC',
      webhook_token: crypto.createHash('sha256').update('other-secret').digest('hex'),
    },
  ]);

  // Valid raw secret lookup
  const matched = await repo.findByWebhookToken(rawSecret);
  assert.ok(matched, 'Must find tenant when raw secret matches stored SHA-256 hash');
  assert.equal(matched.id, 'tenant-a');

  // Invalid secret lookup
  const invalid = await repo.findByWebhookToken('wrong-secret');
  assert.equal(invalid, null, 'Must return null for incorrect token');

  // Null / non-string / undefined
  assert.equal(await repo.findByWebhookToken(null), null);
  assert.equal(await repo.findByWebhookToken(undefined), null);
  assert.equal(await repo.findByWebhookToken(12345), null);
});

test('SupabaseTenantRepository: hashes incoming raw token with SHA-256 before querying DB', async () => {
  const rawSecret = 'gmail-push-secret-987';
  const expectedHash = crypto.createHash('sha256').update(rawSecret).digest('hex');

  let queriedTable = null;
  let queriedFields = null;
  let eqColumn = null;
  let eqValue = null;

  const mockSupabase = {
    from(table) {
      queriedTable = table;
      return {
        select(fields) {
          queriedFields = fields;
          return {
            eq(col, val) {
              eqColumn = col;
              eqValue = val;
              return {
                async maybeSingle() {
                  if (val === expectedHash) {
                    return { data: { id: 'tenant-real-id', webhook_token: expectedHash }, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const repo = new SupabaseTenantRepository(mockSupabase);

  const found = await repo.findByWebhookToken(rawSecret);
  assert.equal(queriedTable, 'tenants');
  assert.equal(eqColumn, 'webhook_token');
  assert.equal(eqValue, expectedHash, 'Database query MUST search by computed SHA-256 hash, not raw token');
  assert.ok(found);
  assert.equal(found.id, 'tenant-real-id');

  // Query with wrong token
  const notFound = await repo.findByWebhookToken('wrong-token');
  assert.equal(notFound, null);
});

test('issueWebhookToken write path: generates random token and stores ONLY SHA-256 hash in DB', async () => {
  let updatedTable = null;
  let updatePayload = null;
  let updateWhereId = null;

  const mockSupabase = {
    from(table) {
      updatedTable = table;
      return {
        update(payload) {
          updatePayload = payload;
          return {
            eq(col, val) {
              updateWhereId = val;
              return {
                select() {
                  return {
                    async maybeSingle() {
                      return { data: { id: val, webhook_token: payload.webhook_token }, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const repo = new SupabaseTenantRepository(mockSupabase);
  const issued = await repo.issueWebhookToken('tenant-xyz');

  assert.ok(issued.rawToken, 'Must return rawToken to caller once');
  assert.equal(typeof issued.rawToken, 'string');
  assert.equal(issued.rawToken.length, 64, 'Raw token should be 32 random bytes in hex (64 chars)');

  const expectedHash = crypto.createHash('sha256').update(issued.rawToken).digest('hex');
  assert.equal(issued.tokenHash, expectedHash);
  assert.equal(updatedTable, 'tenants');
  assert.equal(updateWhereId, 'tenant-xyz');
  assert.equal(updatePayload.webhook_token, expectedHash, 'Database MUST receive the SHA-256 hash, NOT the raw secret');

  // Also test InMemoryTenantRepository write path
  const inMemoryRepo = new InMemoryTenantRepository([{ id: 'tenant-mem' }]);
  const inMemIssued = await inMemoryRepo.issueWebhookToken('tenant-mem');
  assert.ok(inMemIssued.rawToken);
  assert.equal(inMemIssued.tokenHash, crypto.createHash('sha256').update(inMemIssued.rawToken).digest('hex'));

  // Immediate read-back with raw token must succeed
  const found = await inMemoryRepo.findByWebhookToken(inMemIssued.rawToken);
  assert.ok(found);
  assert.equal(found.id, 'tenant-mem');

  // Attempting to query with the stored hash itself must fail (prevents hash reuse)
  const hashLookup = await inMemoryRepo.findByWebhookToken(inMemIssued.tokenHash);
  assert.equal(hashLookup, null, 'Lookup with hash directly must fail because findByWebhookToken hashes its input');
});

