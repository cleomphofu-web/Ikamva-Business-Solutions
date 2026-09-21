import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseSOPRepository } from '../repositories/providers/SupabaseSOPRepository.js';
import { SupabaseTaskLogRepository } from '../repositories/providers/SupabaseTaskLogRepository.js';
import { SupabaseTaskQueueRepository } from '../repositories/providers/SupabaseTaskQueueRepository.js';
import { SupabaseContactRepository } from '../repositories/providers/SupabaseContactRepository.js';
import { SupabaseCompanyKnowledgeRepository } from '../repositories/providers/SupabaseCompanyKnowledgeRepository.js';

function fakeSupabase(result = { data: null, error: null }) {
  const calls = [];
  const db = {
    calls,
    rpc(fn, args) {
      calls.push({ operation: 'rpc', fn, args });
      return Promise.resolve(result);
    },
    from(table) {
      calls.push({ operation: 'from', table });
      const query = {
        table,
        select(value) { calls.push({ operation: 'select', value }); return this; },
        eq(field, value) { calls.push({ operation: 'eq', field, value }); return this; },
        in(field, values) { calls.push({ operation: 'in', field, values }); return this; },
        order(field, options) { calls.push({ operation: 'order', field, options }); return this; },
        limit(value) { calls.push({ operation: 'limit', value }); return this; },
        insert(value) { calls.push({ operation: 'insert', value }); return this; },
        upsert(values, options) { calls.push({ operation: 'upsert', values, options }); return this; },
        update(value) { calls.push({ operation: 'update', value }); return this; },
        maybeSingle: async () => result,
        single: async () => result,
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
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

test('SupabaseCompanyKnowledgeRepository: searchByEmbedding passes match_tenant_id and source_filter to RPC', async () => {
  const db = fakeSupabase({ data: [{ id: 'chunk-1', tenant_id: 'tenant-a', content: 'Price is R100' }], error: null });
  const repo = new SupabaseCompanyKnowledgeRepository(db);
  const embedding = [0.1, 0.2, 0.3];
  await repo.searchByEmbedding('tenant-a', embedding, 3, { sourceFilter: ['catalog.pdf'] });

  const rpcCall = db.calls.find(call => call.operation === 'rpc' && call.fn === 'match_company_knowledge');
  assert.ok(rpcCall, 'Must call match_company_knowledge RPC');
  assert.equal(rpcCall.args.match_tenant_id, 'tenant-a', 'RPC call MUST include match_tenant_id');
  assert.deepEqual(rpcCall.args.query_embedding, embedding);
  assert.deepEqual(rpcCall.args.source_filter, ['catalog.pdf']);
});

test('SupabaseCompanyKnowledgeRepository: keyword search restricts to tenant_id and sourceFilter', async () => {
  const db = fakeSupabase({
    data: [
      { id: 'chunk-1', tenant_id: 'tenant-a', source: 'catalog.pdf', content: 'Our product pricing is R100.' },
    ],
    error: null,
  });
  const repo = new SupabaseCompanyKnowledgeRepository(db);
  const results = await repo.search('tenant-a', 'pricing', 3, { sourceFilter: ['catalog.pdf'] });

  assert.equal(db.calls[0].table, 'company_knowledge');
  const eqTenant = db.calls.find(call => call.operation === 'eq' && call.field === 'tenant_id');
  assert.equal(eqTenant?.value, 'tenant-a', 'Keyword query MUST filter by tenant_id');
  const inSource = db.calls.find(call => call.operation === 'in' && call.field === 'source');
  assert.deepEqual(inSource?.values, ['catalog.pdf'], 'Keyword query MUST filter by source when sourceFilter provided');
  assert.equal(results.length, 1);
});

test('SupabaseCompanyKnowledgeRepository: two distinct tenants never leak knowledge on either search path', async () => {
  const store = [
    { id: 'chunk-a', tenant_id: 'tenant-alpha', source: 'pricing.pdf', content: 'Tenant Alpha exclusive price: R500' },
    { id: 'chunk-b', tenant_id: 'tenant-beta', source: 'pricing.pdf', content: 'Tenant Beta enterprise price: R9900' },
  ];

  // Mock DB that filters based on the query calls (simulating real Supabase behavior under service role)
  function createFilteringMockDb() {
    return {
      calls: [],
      rpc(fn, args) {
        if (fn === 'match_company_knowledge') {
          const matchTenantId = args.match_tenant_id;
          const filter = args.source_filter;
          const matches = store.filter(row => {
            if (row.tenant_id !== matchTenantId) return false;
            if (filter && filter.length > 0 && !filter.includes(row.source)) return false;
            return true;
          });
          return Promise.resolve({ data: matches, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
      from(table) {
        let currentTenant = null;
        let currentSources = null;
        const query = {
          select() { return this; },
          eq(field, val) { if (field === 'tenant_id') currentTenant = val; return this; },
          in(field, vals) { if (field === 'source') currentSources = vals; return this; },
          order() { return this; },
          limit() { return this; },
          then(resolve) {
            const matches = store.filter(row => {
              if (currentTenant && row.tenant_id !== currentTenant) return false;
              if (currentSources && !currentSources.includes(row.source)) return false;
              return true;
            });
            return resolve({ data: matches, error: null });
          },
        };
        return query;
      },
    };
  }

  const db = createFilteringMockDb();
  const repo = new SupabaseCompanyKnowledgeRepository(db);

  // 1. Semantic RPC path
  const rpcAlpha = await repo.searchByEmbedding('tenant-alpha', [0.1], 3);
  assert.equal(rpcAlpha.length, 1);
  assert.ok(rpcAlpha[0].content.includes('Tenant Alpha'));
  assert.ok(!rpcAlpha[0].content.includes('Tenant Beta'));

  const rpcBeta = await repo.searchByEmbedding('tenant-beta', [0.1], 3);
  assert.equal(rpcBeta.length, 1);
  assert.ok(rpcBeta[0].content.includes('Tenant Beta'));
  assert.ok(!rpcBeta[0].content.includes('Tenant Alpha'));

  // 2. Keyword query path
  const kwAlpha = await repo.search('tenant-alpha', 'price', 3);
  assert.equal(kwAlpha.length, 1);
  assert.ok(kwAlpha[0].content.includes('Tenant Alpha'));
  assert.ok(!kwAlpha[0].content.includes('Tenant Beta'));

  const kwBeta = await repo.search('tenant-beta', 'price', 3);
  assert.equal(kwBeta.length, 1);
  assert.ok(kwBeta[0].content.includes('Tenant Beta'));
  assert.ok(!kwBeta[0].content.includes('Tenant Alpha'));
});
