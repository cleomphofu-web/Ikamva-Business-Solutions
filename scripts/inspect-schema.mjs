import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) { env[match[1].trim()] = match[2].trim(); }
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

const cols = await sql(
  "select a.attname, format_type(a.atttypid, a.atttypmod) as data_type, a.attnotnull " +
  "from pg_attribute a " +
  "join pg_class c on a.attrelid = c.oid " +
  "join pg_namespace n on c.relnamespace = n.oid " +
  "where n.nspname = 'public' and c.relname = 'company_knowledge' and a.attnum > 0 " +
  "order by a.attnum"
);
console.log('company_knowledge columns:');
for (const c of cols) {
  console.log(`  ${c.attname.padEnd(30)} ${c.data_type.padEnd(25)} NOT NULL=${c.attnotnull}`);
}
