import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkerEnvironment } from '../config/runtime-env.js';

test('worker environment requires backend secrets and tenant identity', () => {
  assert.throws(() => readWorkerEnvironment({}), /SUPABASE_URL/);
  assert.throws(() => readWorkerEnvironment({ SUPABASE_URL: 'https://example.supabase.co' }), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.throws(() => readWorkerEnvironment({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' }), /IKAMVA_TENANT_ID/);
});

test('worker environment applies safe runtime defaults', () => {
  assert.deepEqual(readWorkerEnvironment({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'secret',
    IKAMVA_TENANT_ID: 'tenant-1',
  }), {
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'secret',
    tenantId: 'tenant-1',
    workerId: `worker-${process.pid}`,
    healthHost: '0.0.0.0',
    healthPort: 4190,
    pollIntervalMs: 1000,
    lockTimeoutMinutes: 10,
    aiProvider: 'groq',
    groqApiKey: '',
  });
});
