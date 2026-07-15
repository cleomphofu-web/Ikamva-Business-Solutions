import { defineQueueRepositoryContractTests } from './contracts/queueRepositoryContract.js';
import { RepositoryFactory } from '../repositories/index.js';

const fixedStart = new Date('2026-01-01T00:00:00.000Z');

const createClock = () => {
  let tick = 0;
  return () => new Date(fixedStart.getTime() + tick++ * 1000);
};

defineQueueRepositoryContractTests('InMemoryTaskQueueRepository', async ({ clientProfiles = [] } = {}) => {
  const clock = createClock();
  const repositoryFactory = new RepositoryFactory({
    clock,
    stores: {
      clientProfiles,
    },
  });
  const repos = repositoryFactory.forTenant('tenant-1');

  return {
    clock,
    repositoryFactory,
    repositories: repos,
    taskQueueRepository: repos.taskQueue,
    taskLogRepository: repos.taskLogs,
    tenantRepository: repos.tenants,
  };
});
