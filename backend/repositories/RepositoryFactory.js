import { createInMemoryRepositoryProvider } from './providers/InMemoryRepositoryProvider.js';
import { createSupabaseRepositoryProvider } from './providers/SupabaseRepositoryProvider.js';

export class MissingTenantContextError extends Error {
  constructor(message = 'RepositoryFactory.forTenant requires tenant context.') {
    super(message);
    this.name = 'MissingTenantContextError';
    this.code = 'missing_tenant_context';
  }
}

export class RepositoryFactory {
  constructor({ provider = 'memory', providers, stores, clock = () => new Date(), supabase } = {}) {
    // Lazily build the default provider map only when needed.
    const repositoryProviders = providers || buildProviders({ stores, clock, supabase });
    const selectedProvider = repositoryProviders[provider];

    if (!selectedProvider?.createSystemRepositories) {
      throw new Error(`Repository provider "${provider}" is not registered.`);
    }

    this.clock = clock;
    this.systemRepositories = selectedProvider.createSystemRepositories();
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

function buildProviders({ stores, clock, supabase }) {
  const map = {
    memory: createInMemoryRepositoryProvider({ stores, clock }),
  };

  // Only register the Supabase provider when a client is supplied.
  // The execution container is responsible for passing it.
  if (supabase) {
    map.supabase = createSupabaseRepositoryProvider({ supabase });
  }

  return map;
}

export class TenantScopedRepositories {
  constructor({ tenantId, systemRepositories }) {
    assertTenantId(tenantId);
    this.tenantId = tenantId;
    this.taskQueue = new TenantScopedTaskQueueRepository(tenantId, systemRepositories.taskQueue);
    this.taskLogs = new TenantScopedTaskLogRepository(tenantId, systemRepositories.taskLogs);
    this.sops = new TenantScopedSOPRepository(tenantId, systemRepositories.sops);
    this.tenants = new TenantScopedTenantRepository(tenantId, systemRepositories.tenants);
    this.contacts = new TenantScopedContactRepository(tenantId, systemRepositories.contacts);
    this.contactNotes = new TenantScopedContactNoteRepository(tenantId, systemRepositories.contactNotes);
    this.leads = new TenantScopedLeadRepository(tenantId, systemRepositories.leads);
    this.projects = new TenantScopedProjectRepository(tenantId, systemRepositories.projects);
    this.employeeActivityLogs = new TenantScopedEmployeeActivityLogRepository(tenantId, systemRepositories.employeeActivityLogs);
    this.employees = new TenantScopedEmployeeRepository(tenantId, systemRepositories.employees);
    this.employeeMemory = new TenantScopedEmployeeMemoryRepository(tenantId, systemRepositories.employeeMemory);
    this.companyKnowledge = new TenantScopedCompanyKnowledgeRepository(tenantId, systemRepositories.companyKnowledge);
    this.approvals = new TenantScopedApprovalRepository(tenantId, systemRepositories.approvals);
    this.tenantIntegrations = new TenantScopedIntegrationRepository(tenantId, systemRepositories.tenantIntegrations);
  }
}

class TenantScopedEmployeeActivityLogRepository {
  constructor(tenantId, repository) { this.tenantId = tenantId; this.repository = repository; }
  append(input) { return this.repository.append({ ...input, tenant_id: this.tenantId }); }
  list(options = {}) { return this.repository.list({ ...options, tenantId: this.tenantId }); }
}
class TenantScopedEmployeeRepository {
  constructor(tenantId, repository) { this.tenantId = tenantId; this.repository = repository; }
  findByTenant() { return this.repository.findByTenant(this.tenantId); }
  findById(id) { return this.repository.findById(this.tenantId, id); }
  create(fields) { return this.repository.create(this.tenantId, fields); }
  update(id, fields) { return this.repository.update(this.tenantId, id, fields); }
  activate(id) { return this.repository.activate(this.tenantId, id); }
}
class TenantScopedEmployeeMemoryRepository {
  constructor(tenantId, repository) { this.tenantId = tenantId; this.repository = repository; }
  listByEmployee(employeeId, options) { return this.repository.listByEmployee(this.tenantId, employeeId, options); }
  create(input) { return this.repository.create(this.tenantId, input); }
}
class TenantScopedCompanyKnowledgeRepository {
  constructor(tenantId, repository) { this.tenantId = tenantId; this.repository = repository; }
  createChunks(chunks) { return this.repository.createChunks(this.tenantId, chunks); }
  list(limit) { return this.repository.list(this.tenantId, limit); }
  search(query, limit) { return this.repository.search(this.tenantId, query, limit); }
  updateEmbedding(id, embedding) { return this.repository.updateEmbedding(this.tenantId, id, embedding); }
  searchByEmbedding(embedding, limit) { return this.repository.searchByEmbedding(this.tenantId, embedding, limit); }
  updateEmbedding(id, embedding) { return this.repository.updateEmbedding(this.tenantId, id, embedding); }
  searchByEmbedding(embedding, limit) { return this.repository.searchByEmbedding(this.tenantId, embedding, limit); }
}
class TenantScopedApprovalRepository {
  constructor(tenantId, repository) { this.tenantId = tenantId; this.repository = repository; }
  list() { return this.repository.list(this.tenantId); }
  create(input) { return this.repository.create({ ...input, tenant_id: this.tenantId }); }
  findById(id) { return this.repository.findById(this.tenantId, id); }
  findByTaskId(taskId) { return this.repository.findByTaskId(this.tenantId, taskId); }
  updateStatus(id, status, reviewedBy, reviewNote) { return this.repository.updateStatus(this.tenantId, id, status, reviewedBy, reviewNote); }
}

class TenantScopedIntegrationRepository {
  constructor(tenantId, repository) { this.tenantId = tenantId; this.repository = repository; }
  list() { return this.repository.list(this.tenantId); }
  findByProvider(provider) { return this.repository.findByProvider(this.tenantId, provider); }
  upsert(fields) { return this.repository.upsert(this.tenantId, fields); }
  disconnect(provider) { return this.repository.disconnect(this.tenantId, provider); }
}

class TenantScopedContactRepository {
  constructor(tenantId, repository) { this.tenantId = tenantId; this.repository = repository; }
  findById(id) { return this.repository.findById(id, this.tenantId); }
  list() { return this.repository.list(this.tenantId); }
  upsert(input) { return this.repository.upsert({ ...input, tenant_id: this.tenantId }); }
}

class TenantScopedContactNoteRepository {
  constructor(tenantId, repository) { this.tenantId = tenantId; this.repository = repository; }
  listByContact(contactId) { return this.repository.listByContact(contactId, this.tenantId); }
  create(input) { return this.repository.create({ ...input, tenant_id: this.tenantId }); }
  delete(id) { return this.repository.delete(id, this.tenantId); }
}
class TenantScopedLeadRepository {
  constructor(tenantId, repository) { this.tenantId = tenantId; this.repository = repository; }
  list() { return this.repository.list(this.tenantId); }
  upsert(input) { return this.repository.upsert({ ...input, tenant_id: this.tenantId }); }
  delete(id) { return this.repository.delete(id, this.tenantId); }
}
class TenantScopedProjectRepository {
  constructor(tenantId, repository) { this.tenantId = tenantId; this.repository = repository; }
  list() { return this.repository.list(this.tenantId); }
  create(input) { return this.repository.create({ ...input, tenant_id: this.tenantId }); }
  update(id, input) { return this.repository.update(id, this.tenantId, input); }
  delete(id) { return this.repository.delete(id, this.tenantId); }
}

class TenantScopedTaskQueueRepository {
  constructor(tenantId, repository) {
    this.tenantId = tenantId;
    this.repository = repository;
  }

  async findById(id) {
    return onlyTenant(await this.repository.findById(id, this.tenantId), this.tenantId);
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
    return this.repository.updateStatus(id, status, { ...patch, tenantId: this.tenantId });
  }

  async scheduleRetry(id, patch) {
    const task = await this.findById(id);
    if (!task) return null;
    return this.repository.scheduleRetry(id, { ...patch, tenantId: this.tenantId });
  }

  async recoverExpiredLocks(options = {}) {
    return this.repository.recoverExpiredLocks({ ...options, tenantId: this.tenantId });
  }

  async getOperationalMetrics() {
    return this.repository.getOperationalMetrics({ tenantId: this.tenantId });
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

  async ensureDefaultChat(input = {}) {
    return this.repository.ensureDefaultChat({ ...input, tenantId: this.tenantId });
  }
  async ensureDefaultEmailWorkflow(input = {}) { return this.repository.ensureDefaultEmailWorkflow({ ...input, tenantId: this.tenantId }); }
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

const assertTenantId = tenantId => {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new MissingTenantContextError();
  }
};

const onlyTenant = (record, tenantId) => {
  if (!record) return null;
  return record.tenant_id === tenantId ? record : null;
};
