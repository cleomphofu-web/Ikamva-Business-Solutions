/**
 * Cross-tenant isolation probe — real two-tenant test.
 *
 * Uses two REAL tenants already present in the live database:
 *   - Tenant A: zwide          (45022903-1067-4f7b-8d1a-84329af38825)
 *   - Tenant B: Codex Chain Test Tenant (588965ca-9dc8-4960-92c3-a95f38b9689a)
 *
 * Inserts one semantically distinct probe chunk under each tenant,
 * then calls match_company_knowledge via the real .rpc() path for each tenant
 * and asserts that tenant A's query never surfaces tenant B's row and vice versa.
 * All probe rows are deleted on exit.
 */
import fs from 'fs';
import path from 'path';

// ── env ───────────────────────────────────────────────────────────────────────
const envPath = path.resolve('.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.trim().match(/^([^=]+)=(.*)/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
}
Object.assign(process.env, env);

// ── Supabase management SQL ────────────────────────────────────────────────────
const projectRef = 'nqoesfyafwakfpawufok';
const mgmtToken  = env.SUPABASE_ACCESS_TOKEN;
async function mgmtSql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    { method: 'POST',
      headers: { 'Authorization': `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }) }
  );
  if (!res.ok) throw new Error(`mgmt API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Supabase JS client + real services ────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { EmbeddingService } = await import('../backend/services/EmbeddingService.js');
const { SupabaseCompanyKnowledgeRepository } = await import(
  '../backend/repositories/providers/SupabaseCompanyKnowledgeRepository.js'
);
const embedder = new EmbeddingService({ geminiApiKey: env.GEMINI_API_KEY });
const repo     = new SupabaseCompanyKnowledgeRepository(supabase);

// ── Two real tenants ──────────────────────────────────────────────────────────
const TENANT_A = { id: '45022903-1067-4f7b-8d1a-84329af38825', name: 'zwide' };
const TENANT_B = { id: '588965ca-9dc8-4960-92c3-a95f38b9689a', name: 'Codex Chain Test Tenant' };

const PROBE_KEY = '__cross_tenant_isolation_probe__';

function probeRow(tenantId, label, content, embedding) {
  return {
    tenant_id        : tenantId,
    logical_key      : PROBE_KEY,
    title            : `Cross-tenant probe [${label}]`,
    category         : 'probe',
    source           : `probe_${label}.pdf`,
    source_type      : 'manual',
    content          : content,
    confidence       : 1.0,
    ingestion_status : 'complete',
    active           : true,
    version          : 1,
    embedding        : embedding,
  };
}

async function cleanup() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from('company_knowledge')
      .delete()
      .eq('tenant_id', t.id)
      .eq('logical_key', PROBE_KEY);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
console.log('=== Cross-Tenant Isolation Probe (Two Real Tenants) ===\n');
console.log(`  Tenant A: ${TENANT_A.name} (${TENANT_A.id})`);
console.log(`  Tenant B: ${TENANT_B.name} (${TENANT_B.id})\n`);

let passed = 0;
const PASS = msg => { console.log(`  ✓ ${msg}`); passed++; };
const FAIL = msg => { throw new Error(`ISOLATION FAILURE: ${msg}`); };

try {
  await cleanup(); // clean slate

  // Semantically distinct content — chosen so the embedding distance between
  // them is large, making any cross-tenant leak unambiguous in similarity scores.
  const textA = 'Tenant zwide confidential: Falcon Prime launch sequence initiates at dawn. Orbital insertion confirmed via ground radar station Alpha Seven.';
  const textB = 'Tenant Codex Chain confidential: Coral Reef biodiversity survey completed. Marine species count reached twelve thousand in sector Delta Nine.';

  console.log('[1] Generate embeddings for both tenants...');
  const [embA, embB] = await Promise.all([embedder.embed(textA), embedder.embed(textB)]);
  PASS(`Embeddings generated — both ${embA.length}-dim`);

  console.log('\n[2] Insert probe chunk into each tenant...');
  const { data: rowA, error: errA } = await supabase
    .from('company_knowledge')
    .insert([probeRow(TENANT_A.id, 'alpha', textA, embA)])
    .select('id, tenant_id');
  if (errA) throw errA;

  const { data: rowB, error: errB } = await supabase
    .from('company_knowledge')
    .insert([probeRow(TENANT_B.id, 'beta', textB, embB)])
    .select('id, tenant_id');
  if (errB) throw errB;

  PASS(`Tenant A row inserted — id=${rowA[0].id.slice(0,8)}… tenant_id=${rowA[0].tenant_id.slice(0,8)}…`);
  PASS(`Tenant B row inserted — id=${rowB[0].id.slice(0,8)}… tenant_id=${rowB[0].tenant_id.slice(0,8)}…`);

  // ── Query A: Tenant A searches for ITS OWN content ────────────────────────
  console.log('\n[3] Query as Tenant A — should return A\'s row, never B\'s...');
  const qA = await embedder.embed('Falcon Prime launch orbital insertion radar Alpha Seven');
  const resA = await repo.searchByEmbedding(TENANT_A.id, qA, 10);

  console.log(`  match_company_knowledge(tenant_id=${TENANT_A.id.slice(0,8)}…) returned ${resA.length} row(s):`);
  for (const r of resA) {
    console.log(`    [tenant=${r.tenant_id.slice(0,8)}…] [sim=${r.similarity?.toFixed(4)}] [source=${r.source}] ${r.content.slice(0, 70)}…`);
  }

  const tenantBLeakedInA = resA.some(r => r.tenant_id === TENANT_B.id);
  if (tenantBLeakedInA) FAIL(`Tenant A query returned Tenant B (${TENANT_B.name}) row!`);
  if (resA.length === 0) FAIL('Tenant A query returned 0 results — probe row should be visible');
  PASS(`Tenant A results: ${resA.length} row(s), zero from Tenant B`);

  // ── Query B: Tenant B queries with Tenant A's semantics — must get nothing ──
  console.log('\n[4] Query as Tenant B searching with Tenant A\'s query — should return 0 from A...');
  const resB_crossQuery = await repo.searchByEmbedding(TENANT_B.id, qA, 10);

  console.log(`  match_company_knowledge(tenant_id=${TENANT_B.id.slice(0,8)}…, query=Falcon Prime…) returned ${resB_crossQuery.length} row(s):`);
  for (const r of resB_crossQuery) {
    console.log(`    [tenant=${r.tenant_id.slice(0,8)}…] [sim=${r.similarity?.toFixed(4)}] [source=${r.source}] ${r.content.slice(0, 70)}…`);
  }

  const tenantALeakedInB = resB_crossQuery.some(r => r.tenant_id === TENANT_A.id);
  if (tenantALeakedInB) FAIL(`Tenant B cross-query returned Tenant A (${TENANT_A.name}) row!`);
  PASS(`Tenant B cross-query: ${resB_crossQuery.length} Tenant A row(s) returned (expected 0)`);

  // ── Query B: Tenant B searches for ITS OWN content ─────────────────────────
  console.log('\n[5] Query as Tenant B — should return B\'s row, never A\'s...');
  const qB = await embedder.embed('Coral Reef biodiversity marine species Delta Nine survey');
  const resB = await repo.searchByEmbedding(TENANT_B.id, qB, 10);

  console.log(`  match_company_knowledge(tenant_id=${TENANT_B.id.slice(0,8)}…) returned ${resB.length} row(s):`);
  for (const r of resB) {
    console.log(`    [tenant=${r.tenant_id.slice(0,8)}…] [sim=${r.similarity?.toFixed(4)}] [source=${r.source}] ${r.content.slice(0, 70)}…`);
  }

  const tenantALeakedInBOwnQuery = resB.some(r => r.tenant_id === TENANT_A.id);
  if (tenantALeakedInBOwnQuery) FAIL(`Tenant B own-query returned Tenant A (${TENANT_A.name}) row!`);
  if (resB.length === 0) FAIL('Tenant B query returned 0 results — probe row should be visible');
  PASS(`Tenant B results: ${resB.length} row(s), zero from Tenant A`);

} finally {
  console.log('\nCleaning up probe rows from both tenants…');
  await cleanup();
  console.log('Cleanup done.');
}

console.log(`\n${'═'.repeat(56)}`);
console.log(`ALL ${passed}/${passed} CROSS-TENANT ISOLATION CHECKS PASSED`);
console.log(`WHERE ck.tenant_id = match_tenant_id is proven against`);
console.log(`two real live tenants with real similarity scores.`);
console.log('═'.repeat(56));
