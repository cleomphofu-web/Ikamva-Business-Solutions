import test from 'node:test';
import assert from 'node:assert/strict';
import { IpRateLimiter } from '../services/IpRateLimiter.js';

test('webhook limiter allows 20 requests per IP and blocks the 21st', () => {
  let now = 1000;
  const limiter = new IpRateLimiter({ now: () => now, logger: { warn() {} } });
  for (let i = 0; i < 20; i += 1) assert.equal(limiter.check('198.51.100.1').allowed, true);
  const blocked = limiter.check('198.51.100.1');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
  assert.equal(limiter.check('198.51.100.2').allowed, true);
  now += 60_000;
  assert.equal(limiter.check('198.51.100.1').allowed, true);
});
