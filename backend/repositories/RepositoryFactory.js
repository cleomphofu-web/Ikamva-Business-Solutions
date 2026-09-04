import { InMemorySOPRepository } from './InMemorySOPRepository.js';
import { InMemoryTaskLogRepository } from './InMemoryTaskLogRepository.js';
import { InMemoryTaskQueueRepository } from './InMemoryTaskQueueRepository.js';
import { InMemoryTenantRepository } from './InMemoryTenantRepository.js';

export class MissingTenantContextError extends Error {
  constructor(message = 'RepositoryFactory.forTenant requires tenant context.') {
    super(message);
    this.name = 'MissingTenantContextError';
    this.code = 'missing_tenant_context';
  }
}

export class RepositoryFactory {
  constructor({ provider = 'memory', stores, clock = () => new Date() } = {}) {
    if (provider !== 'memory') {
      throw new Error(`Repository provider "${provider}" is not registered.`);
    }

    this.clock = clock;
    this.systemRepositories = createInMemorySystemRepositories({ stores, clock });
  }

  forTenant(tenantId) {
    assertTenantId(tenantId);
    return new TenantScopedRepositories({
      tenantId,
      systemRepositories: this.systemRepositories,
    });
  }

  forSystem() {
    // Cross-tenant access is reserved for controlled backend operations such as
    // migrations, maintenance, telemetry, and administrative worker tasks.
    return this.systemRepositories;
  }
}

export class TenantScopedRepositories {
  constructor({ tenantId, systemRepositories }) {
    assertTenantId(tenantId);
    this.tenantId = tenantId;
    this.taskQueue = new TenantScopedTaskQueueRepository(tenantId, systemRepositories.taskQueue);
    this.taskLogs = new TenantScopedTaskLogRepository(tenantId, systemRepositories.taskLogs);
    this.sops = new TenantScopedSOPRepository(tenantId, systemRepositories.sops);
    this.tenants = new TenantScopedTenantRepository(tenantId, systemRepositories.tenants);
  }
}

class TenantScopedTaskQueueRepository {
  constructor(tenantId, repository) {
    this.tenantId = tenantId;
    this.repository = repository;
  }

  async findById(id) {
    return onlyTenant(await this.repository.findById(id), this.tenantId);
  }

  async findByIdempotencyKey(...args) {
    const idempotencyKey = args.length === 1 ? args[0] : args[1];
    return onlyTenant(await this.repository.findByIdempotencyKey(this.tenantId, idempotencyKey), this.tenantId);
  }

  async create(input) {
    return this.repository.create({
      ...input,
      tenant_id: this.tenantId,
    });
  }

  async claimNext(options = {}) {
    return this.repository.claimNext({
      ...options,
      tenantId: this.tenantId,
    });
  }

  async updateStatus(id, status, patch = {}) {
    const task = await this.findById(id);
    if (!task) return null;
    return this.repository.updateStatus(id, status, patch);
  }

  async scheduleRetry(id, patch) {
    const task = await this.findById(id);
    if (!task) return null;
    return this.repository.scheduleRetry(id, patch);
  }
}

class TenantScopedTaskLogRepository {
  constructor(tenantId, repository) {
    this.tenantId = tenantId;
    this.repository = repository;
  }

  async append(input) {
    return this.repository.append({
      ...input,
      tenant_id: this.tenantId,
    });
  }

  async listByTaskId(taskId) {
    const logs = await this.repository.listByTaskId(taskId);
    return logs.filter(log => log.tenant_id === this.tenantId);
  }
}

class TenantScopedSOPRepository {
  constructor(tenantId, repository) {
    this.tenantId = tenantId;
    this.repository = repository;
  }

  async findActiveByTaskType(input) {
    const taskType = typeof input === 'string' ? input : input.taskType;
    return this.repository.findActiveByTaskType({ tenantId: this.tenantId, taskType });
  }

  async findLatestVersion(input) {
    const taskType = typeof input === 'string' ? input : input.taskType;
    return this.repository.findLatestVersion({ tenantId: this.tenantId, taskType });
  }
}

class TenantScopedTenantRepository {
  constructor(tenantId, repository) {
    this.tenantId = tenantId;
    this.repository = repository;
  }

  async findClientProfileById(id) {
    return onlyTenant(await this.repository.findClientProfileById(id), this.tenantId);
  }

  async incrementTasksUsed(clientProfileId) {
    const profile = await this.findClientProfileById(clientProfileId);
    if (!profile) return null;
    return this.repository.incrementTasksUsed(clientProfileId);
  }
}

const createInMemorySystemRepositories = ({ stores = {}, clock }) => ({
  taskQueue: new InMemoryTaskQueueRepository({ clock, store: stores.taskQueue }),
  taskLogs: new InMemoryTaskLogRepository({ clock, store: stores.taskLogs }),
  sops: new InMemorySOPRepository(stores.sops || []),
  tenants: new InMemoryTenantRepository(stores.clientProfiles || []),
});

const assertTenantId = tenantId => {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new MissingTenantContextError();
  }
};

const onlyTenant = (record, tenantId) => {
  if (!record) return null;
  return record.tenant_id === tenantId ? record : null;
};
