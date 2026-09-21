import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryContactRepository } from '../repositories/InMemoryContactRepository.js';
import { CRMContactService } from '../services/CRMContactService.js';

test('CRM contacts remain tenant-scoped and upsert by email', async () => {
  const repository = new InMemoryContactRepository();
  const tenantA = new CRMContactService({ contactRepository: {
    upsert: input => repository.upsert({ ...input, tenant_id: 'tenant-a' }),
    list: () => repository.list('tenant-a'),
  } });
  await tenantA.saveContact({ name: 'Ada', email: 'ADA@example.com' });
  await tenantA.saveContact({ name: 'Ada Updated', email: 'ada@example.com' });
  assert.equal((await tenantA.listContacts()).length, 1);
  assert.equal((await repository.list('tenant-b')).length, 0);
});
