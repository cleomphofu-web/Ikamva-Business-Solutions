import { InMemorySOPRepository } from '../InMemorySOPRepository.js';
import { InMemoryTaskLogRepository } from '../InMemoryTaskLogRepository.js';
import { InMemoryTaskQueueRepository } from '../InMemoryTaskQueueRepository.js';
import { InMemoryTenantRepository } from '../InMemoryTenantRepository.js';

export const createInMemoryRepositoryProvider = ({ stores = {}, clock } = {}) => ({
  createSystemRepositories() {
    return {
      taskQueue: new InMemoryTaskQueueRepository({ clock, store: stores.taskQueue }),
      taskLogs: new InMemoryTaskLogRepository({ clock, store: stores.taskLogs }),
      sops: new InMemorySOPRepository(stores.sops || []),
      tenants: new InMemoryTenantRepository(stores.clientProfiles || []),
    };
  },
});
