import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.trim().match(/^([^=]+)=(.*)/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
}

const projectRef = 'nqoesfyafwakfpawufok';
const token = env.SUPABASE_ACCESS_TOKEN;

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// List all tenants
const tenants = await sql('select id, name, created_at from public.tenants order by created_at limit 20');
console.log('Existing tenants:');
for (const t of tenants) console.log(`  id=${t.id}  name=${t.name}  created=${t.created_at}`);

// Also check tenant_users to understand structure
const cols = await sql(
  "select a.attname, format_type(a.atttypid, a.atttypmod) as t, a.attnotnull " +
  "from pg_attribute a join pg_class c on a.attrelid=c.oid " +
  "join pg_namespace n on c.relnamespace=n.oid " +
  "where n.nspname='public' and c.relname='tenants' and a.attnum > 0 order by a.attnum"
);
console.log('\ntenants table columns:');
for (const c of cols) console.log(`  ${c.attname.padEnd(30)} ${c.t.padEnd(30)} NOT NULL=${c.attnotnull}`);
