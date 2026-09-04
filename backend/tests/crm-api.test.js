import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCRMRequest } from '../api/crm.js';

test('CRM API rejects unauthenticated requests before tenant access', async () => {
  const response = { writeHead(status) { this.status = status; }, end(payload) { this.payload = JSON.parse(payload); } };
  await handleCRMRequest({ headers: {}, method: 'GET' }, response);
  assert.equal(response.status, 401);
  assert.equal(response.payload.error, 'Missing Authorization header');
});
