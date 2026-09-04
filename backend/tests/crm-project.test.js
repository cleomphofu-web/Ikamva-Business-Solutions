import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryFactory } from '../repositories/RepositoryFactory.js';

test('projects are tenant-scoped across create, list, update, and delete', async () => {
  const factory = new RepositoryFactory({ provider: 'memory', stores: { projects: new Map() } });
  const tenantA = factory.forTenant('tenant-a').projects;
  const tenantB = factory.forTenant('tenant-b').projects;
  const project = await tenantA.create({ title: 'A project', client_email: 'a@example.com' });
  assert.equal((await tenantA.list()).length, 1);
  assert.equal((await tenantB.list()).length, 0);
  await tenantA.update(project.id, { status: 'in_progress' });
  assert.equal((await tenantA.list())[0].status, 'in_progress');
  assert.equal(await tenantB.delete(project.id), null);
  assert.ok(await tenantA.delete(project.id));
  assert.equal((await tenantA.list()).length, 0);
});
