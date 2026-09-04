import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RepositoryFactory } from '../repositories/index.js';
import { createExecutionContainer, createTenantExecutionContainer, ServiceContainer } from '../container/index.js';

describe('ServiceContainer', () => {
  it('uses explicit registrations only', () => {
    const container = new ServiceContainer();
    const value = { ok: true };

    container.registerValue('value', value);

    assert.equal(container.resolve('value'), value);
    assert.throws(() => container.resolve('missing'), /not registered/);
  });

  it('wires WorkerEngine with tenant-scoped repositories from RepositoryFactory', async () => {
    const repositoryFactory = new RepositoryFactory({
      stores: {
        clientProfiles: [{
          id: 'client-1',
          tenant_id: 'tenant-1',
          monthly_task_limit: 5,
          tasks_used_this_month: 0,
        }],
        sops: [{
          id: 'sop-1',
          tenant_id: 'tenant-1',
          task_type: 'email',
          version: 1,
          active: true,
          system_prompt: 'Complete the email task.',
          validation_schema: { required: ['subject'] },
          model_provider: 'mock',
        }],
      },
    });
    const root = createExecutionContainer({ repositoryFactory });
    const tenantContainer = createTenantExecutionContainer({ tenantId: 'tenant-1', rootContainer: root });
    const queueService = tenantContainer.resolve('queueService');
    const workerEngine = tenantContainer.resolve('workerEngine');

    const task = await queueService.enqueueTask({
      client_profile_id: 'client-1',
      task_type: 'email',
      payload: { subject: 'Hello' },
      idempotency_key: 'container-task',
    });
    const completed = await workerEngine.processNext({ workerId: 'worker-1' });

    assert.equal(task.tenant_id, 'tenant-1');
    assert.equal(completed.status, 'completed');
  });
});
