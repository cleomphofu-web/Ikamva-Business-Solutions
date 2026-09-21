import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkerTelemetry } from '../workers/WorkerTelemetry.js';

test('WorkerTelemetry exposes bounded operational counters and error metadata', () => {
  const telemetry = new WorkerTelemetry({ clock: () => new Date('2026-08-25T10:00:00.000Z') });
  telemetry.recordTick();
  telemetry.recordProcessed();
  telemetry.recordIdle();
  telemetry.recordRecovery(2);
  telemetry.recordError(new Error('queue unavailable'));

  assert.deepEqual(telemetry.snapshot(), {
    started_at: '2026-08-25T10:00:00.000Z',
    ticks: 1,
    processed: 1,
    idle: 1,
    recoveries: 2,
    errors: 1,
    last_error: { message: 'queue unavailable', at: '2026-08-25T10:00:00.000Z' },
  });
});
