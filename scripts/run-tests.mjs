import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const testDir = path.resolve(process.cwd(), 'backend', 'tests');
const testFiles = fs.readdirSync(testDir)
  .filter((file) => file.endsWith('.test.js'))
  .map((file) => path.join('backend', 'tests', file));

const child = spawn(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
