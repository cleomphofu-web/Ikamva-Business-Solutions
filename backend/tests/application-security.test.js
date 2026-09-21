import test from 'node:test';
import assert from 'node:assert/strict';
import { tenantSlugForApplication } from '../api/applications.js';

test('tenant slugs are bound to the approved application identity', () => {
  const first = tenantSlugForApplication({
    user_id: '11111111-1111-1111-1111-111111111111',
    company_name: 'Same Company',
  });
  const second = tenantSlugForApplication({
    user_id: '22222222-2222-2222-2222-222222222222',
    company_name: 'Same Company',
  });

  assert.notEqual(first, second);
  assert.equal(first, 'same-company-11111111');
  assert.equal(second, 'same-company-22222222');
});

test('tenant slug generation has a safe fallback for missing company data', () => {
  assert.equal(
    tenantSlugForApplication({ user_id: 'abcdef12-0000-0000-0000-000000000000' }),
    'ikamva-abcdef12',
  );
});
