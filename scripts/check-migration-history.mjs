import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const migrationDir = new URL('../supabase/migrations/', import.meta.url);
const local = (await readdir(migrationDir))
  .filter(name => /^\d{12}_.+\.sql$/.test(name))
  .map(name => name.slice(0, 12));

const command = process.platform === 'win32' ? 'cmd.exe' : 'supabase';
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'supabase migration list --linked']
  : ['migration', 'list', '--linked'];
const result = await new Promise(resolve => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', error => resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` }));
  child.on('close', code => resolve({ code, stdout, stderr }));
});

const output = `${result.stdout}\n${result.stderr}`;
const payload = [...output.matchAll(/\{"migrations":\[[\s\S]*?\]\,"message":"Migrations listed"\}/g)].at(-1)?.[0];
if (!payload) {
  console.error('Could not read Supabase migration history.');
  const diagnostic = output.trim();
  if (diagnostic) console.error(diagnostic.slice(-2000));
  process.exit(1);
}

const history = JSON.parse(payload).migrations;
const remote = history.map(entry => entry.remote).filter(Boolean);
const localOnly = local.filter(version => !remote.includes(version));
const remoteOnly = remote.filter(version => !local.includes(version));

console.log(JSON.stringify({ local, remote, localOnly, remoteOnly }, null, 2));
if (localOnly.length || remoteOnly.length) {
  console.error('\nMigration history drift detected. Reconcile with an approved Supabase migration repair plan before deployment.');
  process.exit(2);
}

console.log('\nMigration history is reconciled.');
