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

test('WorkerRuntime schedule gating: does NOT pull work before shift start, pulls during shift, stops after shift end', async () => {
  const processedCalls = [];
  const fakeEmployeeRepo = {
    findByTenant: async () => ({
      id: 'emp-1',
      schedule: {
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        start: '09:00',
        end: '17:00',
        timezone: 'Africa/Johannesburg', // UTC+2
      },
    }),
  };

  let simulatedTime = new Date('2026-09-16T06:30:00Z'); // 08:30 CAT -> before 09:00 start

  const runtime = new WorkerRuntime({
    engine: {
      processNext: async options => {
        processedCalls.push({ time: simulatedTime.toISOString(), options });
        return { task_id: 'task-101', status: 'completed' };
      },
    },
    queueRepository: { claimNext: () => null },
    employeeRepository: fakeEmployeeRepo,
    tenantId: 'tenant-schedule-test',
    workerId: 'worker-schedule-test',
    clock: () => simulatedTime,
  });

  runtime.running = true;

  // 1. Tick before shift start (08:30 CAT) -> Engine must NOT be polled
  const tick1 = await runtime.tick();
  assert.equal(tick1, null, 'Tick before shift start should return null and not poll engine');
  assert.equal(processedCalls.length, 0, 'No tasks should have been processed before shift start');

  // 2. Advance time to 09:15 CAT (07:15 UTC) -> Inside shift window -> Engine MUST be polled
  simulatedTime = new Date('2026-09-16T07:15:00Z');
  const tick2 = await runtime.tick();
  assert.ok(tick2, 'Tick during shift should process work');
  assert.equal(processedCalls.length, 1, 'Exactly one task should be processed during shift');
  assert.equal(processedCalls[0].options.tenantId, 'tenant-schedule-test');

  // 3. Advance time to 17:30 CAT (15:30 UTC) -> After shift end -> Engine must NOT be polled
  simulatedTime = new Date('2026-09-16T15:30:00Z');
  const tick3 = await runtime.tick();
  assert.equal(tick3, null, 'Tick after shift end should return null and not poll engine');
  assert.equal(processedCalls.length, 1, 'Processed count should remain 1 after shift end');

  // 4. Advance time to next day 10:00 CAT (2026-09-17T08:00:00Z) -> Automatically resumes pulling work
  simulatedTime = new Date('2026-09-17T08:00:00Z');
  const tick4 = await runtime.tick();
  assert.ok(tick4, 'Tick on next day within shift should automatically resume pulling work');
  assert.equal(processedCalls.length, 2, 'Processed count should increment to 2 on next day');

  await runtime.stop();
});

