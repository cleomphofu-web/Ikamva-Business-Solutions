import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateRequest } from '../api/applications.js';

const request = authorization => ({ headers: authorization ? { authorization } : {} });

test('application authentication rejects a missing bearer token', async () => {
  await assert.rejects(
    authenticateRequest(request(), { client: { auth: { getUser: async () => ({}) } } }),
    error => error.status === 401 && error.message === 'Missing Authorization header',
  );
});

test('application authentication rejects an invalid bearer token', async () => {
  const client = { auth: { getUser: async () => ({ data: {}, error: { message: 'invalid token' } }) } };
  await assert.rejects(
    authenticateRequest(request('Bearer expired-token'), { client }),
    error => error.status === 401 && error.message === 'Invalid or expired token',
  );
});

test('application authentication returns the verified Supabase identity', async () => {
  const user = { id: 'user-1', email: 'owner@example.com' };
  const client = { auth: { getUser: async () => ({ data: { user }, error: null }) } };
  assert.deepEqual(await authenticateRequest(request('Bearer valid-token'), { client }), user);
});
