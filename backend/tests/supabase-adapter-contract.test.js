import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseSOPRepository } from '../repositories/providers/SupabaseSOPRepository.js';
import { SupabaseTaskLogRepository } from '../repositories/providers/SupabaseTaskLogRepository.js';
import { SupabaseTaskQueueRepository } from '../repositories/providers/SupabaseTaskQueueRepository.js';
import { SupabaseContactRepository } from '../repositories/providers/SupabaseContactRepository.js';

function fakeSupabase(result = { data: null, error: null }) {
  const calls = [];
  const db = {
    calls,
    from(table) {
      calls.push({ operation: 'from', table });
      const query = {
        table,
        select(value) { calls.push({ operation: 'select', value }); return this; },
        eq(field, value) { calls.push({ operation: 'eq', field, value }); return this; },
        order(field, options) { calls.push({ operation: 'order', field, options }); return this; },
        limit(value) { calls.push({ operation: 'limit', value }); return this; },
        insert(value) { calls.push({ operation: 'insert', value }); return this; },
        upsert(values, options) { calls.push({ operation: 'upsert', values, options }); return this; },
        update(value) { calls.push({ operation: 'update', value }); return this; },
        maybeSingle: async () => result,
        single: async () => result,
      };
      return query;
    },
  };
  return db;
}

test('SOP adapter targets the migration-defined client_sops contract', async () => {
  const db = fakeSupabase({ data: { id: 'sop-1' }, error: null });
  await new SupabaseSOPRepository(db).findActiveByTaskType({ tenantId: 'tenant-1', taskType: 'chat' });
  assert.equal(db.calls.find(call => call.operation === 'eq' && call.field === 'active')?.value, true);
  assert.equal(db.calls.find(call => call.operation === 'eq' && call.field === 'tenant_id')?.value, 'tenant-1');
  assert.equal(db.calls.find(call => call.operation === 'eq' && call.field === 'task_type')?.value, 'chat');
  assert.equal(db.calls[0].table, 'client_sops');
});

test('task log adapter stores event type inside metadata, not a nonexistent column', async () => {
  const db = fakeSupabase({ data: { id: 'log-1' }, error: null });
  await new SupabaseTaskLogRepository(db).append({
    tenant_id: 'tenant-1', task_id: 'task-1', event_type: 'TASK_CREATED', to_status: 'pending',
  });
  const insert = db.calls.find(call => call.operation === 'insert');
  assert.equal(insert.value.event_type, undefined);
  assert.deepEqual(insert.value.metadata, {});
});

test('tenant-scoped task updates include the tenant predicate', async () => {
  const db = fakeSupabase({ data: { id: 'task-1', tenant_id: 'tenant-1' }, error: null });
  await new SupabaseTaskQueueRepository(db).updateStatus('task-1', 'completed', { tenantId: 'tenant-1' });
  assert.deepEqual(
    db.calls.filter(call => call.operation === 'eq').map(call => [call.field, call.value]),
    [['id', 'task-1'], ['tenant_id', 'tenant-1']],
  );
});

test('CRM contact upserts include tenant identity and conflict key', async () => {
  const db = fakeSupabase({ data: { id: 'contact-1', tenant_id: 'tenant-1' } });
  const repository = new SupabaseContactRepository(db);
  await repository.upsert({ tenant_id: 'tenant-1', name: 'Ada', email: 'ada@example.com' });
  const upsert = db.calls.find(call => call.operation === 'upsert');
  assert.deepEqual(upsert.options, { onConflict: 'tenant_id,email' });
  assert.equal(upsert.values.tenant_id, 'tenant-1');
});

test('CRM contact admin listing does not add a tenant predicate', async () => {
  const db = fakeSupabase({ data: [{ id: 'contact-1' }], error: null });
  await new SupabaseContactRepository(db).listAll();
  assert.equal(db.calls.some(call => call.operation === 'eq' && call.field === 'tenant_id'), false);
});
