import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { MockAIProvider } from '../providers/MockAIProvider.js';
import { RepositoryFactory } from '../repositories/RepositoryFactory.js';
import { AuditService } from '../services/AuditService.js';
import { QueueService } from '../services/QueueService.js';
import { QuotaService } from '../services/QuotaService.js';
import { SOPService } from '../services/SOPService.js';
import { BaseWorker } from '../workers/BaseWorker.js';
import { WorkerEngine } from '../workers/WorkerEngine.js';
import { WorkerRegistry } from '../workers/WorkerRegistry.js';
import { ServiceContainer } from './ServiceContainer.js';

export const createExecutionContainer = ({ repositoryFactory = new RepositoryFactory(), providers, workers, clock } = {}) => {
  const container = new ServiceContainer();

  container
    .registerValue('clock', clock || (() => new Date()))
    .registerValue('repositoryFactory', repositoryFactory)
    .register('providerRegistry', () => providers || new ProviderRegistry().register('mock', new MockAIProvider()))
    .register('workerRegistry', () => workers || new WorkerRegistry().register('email', new BaseWorker({ taskType: 'email', providerName: 'mock' })));

  return container;
};

export const createTenantExecutionContainer = ({ tenantId, rootContainer }) => {
  const scoped = rootContainer.createScope();
  const repos = rootContainer.resolve('repositoryFactory').forTenant(tenantId);

  scoped
    .registerValue('tenantId', tenantId)
    .registerValue('repositories', repos)
    .register('auditService', container => new AuditService({ taskLogRepository: container.resolve('repositories').taskLogs }))
    .register('queueService', container => new QueueService({
      taskQueueRepository: container.resolve('repositories').taskQueue,
      auditService: container.resolve('auditService'),
      clock: container.resolve('clock'),
    }))
    .register('sopService', container => new SOPService({ sopRepository: container.resolve('repositories').sops }))
    .register('quotaService', container => new QuotaService({ tenantRepository: container.resolve('repositories').tenants }))
    .register('workerEngine', container => new WorkerEngine({
      queueService: container.resolve('queueService'),
      sopService: container.resolve('sopService'),
      quotaService: container.resolve('quotaService'),
      tenantRepository: container.resolve('repositories').tenants,
      providerRegistry: container.resolve('providerRegistry'),
      workerRegistry: container.resolve('workerRegistry'),
      auditService: container.resolve('auditService'),
    }));

  return scoped;
};
