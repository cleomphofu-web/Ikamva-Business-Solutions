import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkerRuntime } from '../workers/WorkerRuntime.js';

test('WorkerRuntime recovers expired locks before polling the engine', async () => {
  const calls = [];
  const runtime = new WorkerRuntime({
    engine: { processNext: async options => { calls.push(['process', options]); return null; } },
    queueRepository: { claimNext: () => null, recoverExpiredLocks: async options => calls.push(['recover', options]) },
    tenantId: 'tenant-1',
    workerId: 'worker-1',
    lockTimeoutMinutes: 7,
  });

  runtime.running = true;
  await runtime.tick();

  assert.deepEqual(calls, [
    ['recover', { timeoutMinutes: 7, tenantId: 'tenant-1' }],
    ['process', { tenantId: 'tenant-1', workerId: 'worker-1', taskTypes: [] }],
  ]);
  await runtime.stop();
});

test('WorkerRuntime stop is idempotent and prevents future polling', async () => {
  let processed = 0;
  const runtime = new WorkerRuntime({
    engine: { processNext: async () => { processed += 1; return null; } },
    queueRepository: { claimNext: () => null },
    pollIntervalMs: 1,
  });

  runtime.start();
  await runtime.stop();
  await runtime.stop();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(runtime.running, false);
  assert.ok(processed <= 1);
});
