import assert from 'node:assert/strict';
import test from 'node:test';
import { RepositoryFactory } from '../repositories/index.js';

const createRepos = () => {
  const repositoryFactory = new RepositoryFactory({
    stores: {
      employees: [{
        id: 'employee-existing',
        tenant_id: 'tenant-1',
        name: 'Existing Employee',
        lifecycle_status: 'configuring',
        setup_step: '2',
      }],
    },
  });
  return { repositoryFactory, tenantOne: repositoryFactory.forTenant('tenant-1'), tenantTwo: repositoryFactory.forTenant('tenant-2') };
};

test('EmployeeRepository contract: create and retrieve by tenant', async () => {
  const { tenantOne } = createRepos();
  const created = await tenantOne.employees.create({
    name: 'Sarah',
    role: 'Customer Operations Specialist',
    personality: 'Warm and precise',
    setup_step: '1',
  });

  assert.equal(created.tenant_id, 'tenant-1');
  assert.equal((await tenantOne.employees.findById(created.id)).id, created.id);
  assert.equal((await tenantOne.employees.findById(created.id)).name, 'Sarah');
});

test('EmployeeRepository contract: update persists configuration fields', async () => {
  const { tenantOne } = createRepos();
  const updated = await tenantOne.employees.update('employee-existing', {
    personality: 'Calm, direct, and helpful',
    configuration: { company_name: 'Ikamva Business Solutions' },
    setup_step: '2',
  });

  assert.equal(updated.personality, 'Calm, direct, and helpful');
  assert.deepEqual(updated.configuration, { company_name: 'Ikamva Business Solutions' });
  assert.equal(updated.setup_step, '2');
});

test('EmployeeRepository contract: activate sets active lifecycle fields', async () => {
  const { tenantOne } = createRepos();
  const activated = await tenantOne.employees.activate('employee-existing');

  assert.equal(activated.lifecycle_status, 'active');
  assert.equal(activated.setup_step, 'complete');
  assert.ok(activated.activated_at);
});

test('EmployeeRepository contract: tenant isolation applies to retrieve, update, and activate', async () => {
  const { tenantOne, tenantTwo } = createRepos();

  assert.equal(await tenantTwo.employees.findById('employee-existing'), null);
  assert.equal(await tenantTwo.employees.update('employee-existing', { name: 'Cross-tenant write' }), null);
  assert.equal(await tenantTwo.employees.activate('employee-existing'), null);
  assert.equal((await tenantOne.employees.findById('employee-existing')).name, 'Existing Employee');
});
