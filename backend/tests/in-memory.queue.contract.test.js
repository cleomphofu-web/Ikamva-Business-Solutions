import { defineQueueRepositoryContractTests } from './contracts/queueRepositoryContract.js';
import {
  InMemoryTaskLogRepository,
  InMemoryTaskQueueRepository,
  InMemoryTenantRepository,
} from '../repositories/index.js';

const fixedStart = new Date('2026-01-01T00:00:00.000Z');

const createClock = () => {
  let tick = 0;
  return () => new Date(fixedStart.getTime() + tick++ * 1000);
};

defineQueueRepositoryContractTests('InMemoryTaskQueueRepository', async ({ clientProfiles = [] } = {}) => {
  const clock = createClock();

  return {
    clock,
    taskQueueRepository: new InMemoryTaskQueueRepository({ clock }),
    taskLogRepository: new InMemoryTaskLogRepository({ clock }),
    tenantRepository: new InMemoryTenantRepository(clientProfiles),
  };
});
