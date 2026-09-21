/**
 * Live RAG Verification Probe — checks 1-3 use the Management API against the
 * real pg_proc / pg_attribute catalog; check 4 exercises the actual RPC call
 * via the service-role client using the project's real IKAMVA_TENANT_ID.
 *
 * Nothing is left in the database after the probe exits.
 */
import fs from 'fs';
import path from 'path';

// ── env ──────────────────────────────────────────────────────────────────────
const envPath = path.resolve('.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.trim().match(/^([^=]+)=(.*)/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
}
Object.assign(process.env, env);

// ── Supabase Management SQL helper ───────────────────────────────────────────
const projectRef = 'nqoesfyafwakfpawufok';
const mgmtToken  = env.SUPABASE_ACCESS_TOKEN;

async function mgmtSql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method : 'POST',
      headers: { 'Authorization': `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ query })
    }
  );
  if (!res.ok) throw new Error(`mgmt API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Supabase JS client (service-role — same path as real backend) ─────────────
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── real services ─────────────────────────────────────────────────────────────
const { EmbeddingService } = await import('../backend/services/EmbeddingService.js');
const { SupabaseCompanyKnowledgeRepository } = await import(
  '../backend/repositories/providers/SupabaseCompanyKnowledgeRepository.js'
);
const embedder = new EmbeddingService({ geminiApiKey: env.GEMINI_API_KEY });
const repo     = new SupabaseCompanyKnowledgeRepository(supabase);

const REAL_TENANT = env.IKAMVA_TENANT_ID; // real tenant from .env
const PROBE_KEY_A = '__probe_source_alpha__';
const PROBE_KEY_B = '__probe_source_beta__';

function probeRow(logicalKey, content, source, embedding) {
  return {
    tenant_id        : REAL_TENANT,
    logical_key      : logicalKey,
    title            : `Probe ${logicalKey}`,
    category         : 'probe',
    source           : source,
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
  await supabase.from('company_knowledge')
    .delete()
    .eq('tenant_id', REAL_TENANT)
    .in('logical_key', [PROBE_KEY_A, PROBE_KEY_B]);
}

// ── main ─────────────────────────────────────────────────────────────────────
console.log('=== Live RAG Verification Probe ===\n');

let passed = 0;
const PASS = msg => { console.log(`  ✓ ${msg}`); passed++; };
const FAIL = msg => { throw new Error(`FAILED: ${msg}`); };

try {

  // Check 1 — Gemini dimension
  console.log('[1] Gemini embedding dimension');
  const v = await embedder.embed('probe dimension check');
  if (v.length !== 768) FAIL(`Expected 768 dims, got ${v.length}`);
  PASS(`Gemini emits ${v.length}-dim vectors`);

  // Check 2 — live column type
  console.log('[2] company_knowledge.embedding column type (live pg_attribute)');
  const [colRow] = await mgmtSql(
    "select format_type(a.atttypid, a.atttypmod) as t " +
    "from pg_attribute a join pg_class c on a.attrelid=c.oid " +
    "join pg_namespace n on c.relnamespace=n.oid " +
    "where n.nspname='public' and c.relname='company_knowledge' and a.attname='embedding'"
  );
  if (colRow.t !== 'vector(768)') FAIL(`column type '${colRow.t}', expected 'vector(768)'`);
  PASS(`column is ${colRow.t}`);

  // Check 3 — exactly 1 function overload
  console.log('[3] match_company_knowledge overloads in live pg_proc');
  const funcRows = await mgmtSql(
    "select pg_get_function_identity_arguments(oid) as sig " +
    "from pg_proc where proname='match_company_knowledge'"
  );
  console.log(`  Found ${funcRows.length} overload(s):`);
  funcRows.forEach(r => console.log(`    → (${r.sig})`));
  if (funcRows.length !== 1) FAIL(`Expected exactly 1 overload, found ${funcRows.length}`);
  const sig = funcRows[0].sig;
  if (!sig.includes('source_filter')) FAIL(`Signature missing source_filter: ${sig}`);
  PASS(`Exactly 1 overload — (${sig})`);

  // Check 4 — live RPC + source_filter isolation
  console.log('[4] Live RPC call and source_filter isolation');
  await cleanup();

  const textA = 'Ikamva probe Alpha: quantum entanglement drives operational velocity in autumn.';
  const textB = 'Ikamva probe Beta: photosynthesis yields chromatic optimisation in winter.';

  const [embA, embB] = await Promise.all([
    embedder.embed(textA),
    embedder.embed(textB)
  ]);

  const { data: rowsA, error: errA } = await supabase
    .from('company_knowledge')
    .insert([probeRow(PROBE_KEY_A, textA, 'probe_alpha.pdf', embA)])
    .select('id');
  if (errA) throw errA;

  const { data: rowsB, error: errB } = await supabase
    .from('company_knowledge')
    .insert([probeRow(PROBE_KEY_B, textB, 'probe_beta.pdf', embB)])
    .select('id');
  if (errB) throw errB;

  PASS(`Inserted probe rows — Alpha id=${rowsA[0].id.slice(0,8)}… Beta id=${rowsB[0].id.slice(0,8)}…`);

  // Query that semantically matches Alpha
  const qAlpha = await embedder.embed('quantum entanglement operational velocity autumn');
  const allResults = await repo.searchByEmbedding(REAL_TENANT, qAlpha, 10);
  console.log(`  Unfiltered RPC returned ${allResults.length} results`);

  // With filter locked to alpha source — must return alpha, must NOT return beta
  const filteredAlpha = await repo.searchByEmbedding(REAL_TENANT, qAlpha, 10, { sourceFilter: ['probe_alpha.pdf'] });
  console.log(`  sourceFilter=['probe_alpha.pdf'] → ${filteredAlpha.length} result(s):`);
  filteredAlpha.forEach(r => console.log(`    [source=${r.source}] [sim=${r.similarity?.toFixed(4)}] ${r.content.slice(0,60)}…`));
  if (filteredAlpha.some(r => r.source === 'probe_beta.pdf'))
    FAIL('source_filter leaked probe_beta.pdf into probe_alpha query');
  if (filteredAlpha.length === 0)
    FAIL('source_filter returned 0 results — probe alpha row should be retrievable');
  PASS(`source_filter=['probe_alpha.pdf'] returns ${filteredAlpha.length} row(s), zero from beta source`);

  // With filter locked to beta source — must NOT return alpha
  const filteredBeta = await repo.searchByEmbedding(REAL_TENANT, qAlpha, 10, { sourceFilter: ['probe_beta.pdf'] });
  console.log(`  sourceFilter=['probe_beta.pdf'] → ${filteredBeta.length} result(s):`);
  filteredBeta.forEach(r => console.log(`    [source=${r.source}] [sim=${r.similarity?.toFixed(4)}] ${r.content.slice(0,60)}…`));
  if (filteredBeta.some(r => r.source === 'probe_alpha.pdf'))
    FAIL('source_filter leaked probe_alpha.pdf into probe_beta query');
  PASS(`source_filter=['probe_beta.pdf'] returns ${filteredBeta.length} row(s), zero from alpha source`);

  // Nonexistent filter — must return 0
  const filteredNone = await repo.searchByEmbedding(REAL_TENANT, qAlpha, 10, { sourceFilter: ['does_not_exist.pdf'] });
  if (filteredNone.length !== 0)
    FAIL(`Expected 0 from nonexistent source_filter, got ${filteredNone.length}`);
  PASS('source_filter with nonexistent filename returns 0 results');

} finally {
  console.log('\nCleaning up probe rows…');
  await cleanup();
  console.log('Cleanup done.');
}

console.log(`\n${'═'.repeat(52)}`);
console.log(`ALL ${passed}/5 LIVE DATABASE CHECKS PASSED`);
console.log('═'.repeat(52));
