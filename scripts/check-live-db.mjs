import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[match[1].trim()] = val;
    }
  }
}

const projectRef = 'nqoesfyafwakfpawufok';
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function executeSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  return await res.json();
}

async function main() {
  console.log('--- Step 1: Query current match_company_knowledge functions in pg_proc ---');
  const before = await executeSql(`
    select 
      proname,
      pg_get_function_identity_arguments(oid) as identity_args,
      pg_get_function_arguments(oid) as all_args
    from pg_proc
    where proname = 'match_company_knowledge';
  `);
  console.log('Before cleanup:', JSON.stringify(before, null, 2));

  console.log('\n--- Step 2: Check company_knowledge.embedding column type in pg_attribute ---');
  const colInfo = await executeSql(`
    select 
      a.attname as column_name,
      format_type(a.atttypid, a.atttypmod) as full_data_type
    from pg_attribute a
    join pg_class c on a.attrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where n.nspname = 'public' and c.relname = 'company_knowledge' and a.attname = 'embedding';
  `);
  console.log('Column info:', JSON.stringify(colInfo, null, 2));

  console.log('\n--- Step 3: Run cleanup & redefine migration ---');
  const migrationSql = `
    drop function if exists public.match_company_knowledge(vector(1536), uuid, integer);
    drop function if exists public.match_company_knowledge(vector(1536), double precision, integer, uuid, text[]);
    drop function if exists public.match_company_knowledge(vector(768), uuid, integer);

    create or replace function public.match_company_knowledge(
      query_embedding vector(768),
      match_tenant_id uuid,
      match_count     integer default 3,
      source_filter   text[]  default null
    )
    returns table (id uuid, tenant_id uuid, content text, source text, similarity double precision)
    language sql stable
    as $$
      select ck.id, ck.tenant_id, ck.content, ck.source,
             1 - (ck.embedding <=> query_embedding) as similarity
      from public.company_knowledge ck
      where ck.tenant_id = match_tenant_id
        and ck.active = true
        and ck.embedding is not null
        and (source_filter is null or ck.source = any(source_filter))
      order by ck.embedding <=> query_embedding
      limit least(greatest(match_count, 1), 20);
    $$;
  `;
  await executeSql(migrationSql);
  console.log('Cleanup & redefine SQL executed successfully.');

  console.log('\n--- Step 4: Query pg_proc again (verifying exactly 1 row) ---');
  const after = await executeSql(`
    select 
      proname,
      pg_get_function_identity_arguments(oid) as identity_args,
      pg_get_function_arguments(oid) as all_args
    from pg_proc
    where proname = 'match_company_knowledge';
  `);
  console.log('After cleanup:', JSON.stringify(after, null, 2));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
