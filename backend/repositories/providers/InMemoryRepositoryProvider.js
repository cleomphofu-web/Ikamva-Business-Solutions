import { InMemorySOPRepository } from '../InMemorySOPRepository.js';
import { InMemoryTaskLogRepository } from '../InMemoryTaskLogRepository.js';
import { InMemoryTaskQueueRepository } from '../InMemoryTaskQueueRepository.js';
import { InMemoryTenantRepository } from '../InMemoryTenantRepository.js';
import { InMemoryContactRepository } from '../InMemoryContactRepository.js';
import { InMemoryContactNoteRepository } from '../InMemoryContactNoteRepository.js';
import { InMemoryLeadRepository } from '../InMemoryLeadRepository.js';
import { InMemoryLeadRepository as InMemoryProjectRepository } from '../InMemoryLeadRepository.js';
import { InMemoryEmployeeMemoryRepository } from '../InMemoryEmployeeMemoryRepository.js';
import { InMemoryCompanyKnowledgeRepository } from '../InMemoryCompanyKnowledgeRepository.js';

export const createInMemoryRepositoryProvider = ({ stores = {}, clock } = {}) => ({
  createSystemRepositories() {
    return {
      taskQueue: new InMemoryTaskQueueRepository({ clock, store: stores.taskQueue }),
      taskLogs: new InMemoryTaskLogRepository({ clock, store: stores.taskLogs }),
      sops: new InMemorySOPRepository(stores.sops || []),
      tenants: new InMemoryTenantRepository(stores.clientProfiles || []),
      contacts: new InMemoryContactRepository({ store: stores.contacts, clock }),
      contactNotes: new InMemoryContactNoteRepository({ store: stores.contactNotes, clock }),
      leads: new InMemoryLeadRepository({ store: stores.leads, clock }),
      projects: new InMemoryProjectRepository({ store: stores.projects, clock }),
      employeeActivityLogs: new InMemoryEmployeeActivityLogRepository(stores.employeeActivityLogs),
      employees: new InMemoryEmployeeRepository(stores.employees),
      employeeMemory: new InMemoryEmployeeMemoryRepository(stores.employeeMemory),
      companyKnowledge: new InMemoryCompanyKnowledgeRepository(stores.companyKnowledge),
      approvals: new InMemoryApprovalRepository(stores.approvals),
      tenantIntegrations: new InMemoryTenantIntegrationRepository(stores.tenantIntegrations),
    };
  },
});

class InMemoryEmployeeActivityLogRepository {
  constructor(store = []) { this.store = store || []; }
  async append(input) {
    const row = { id: `activity-${this.store.length + 1}`, ...input, created_at: new Date().toISOString() };
    this.store.push(row);
    return row;
  }
}
class InMemoryEmployeeRepository {
  constructor(store = []) { this.store = store || []; }
  async findByTenant(tenantId) { return this.store.find(x => x.tenant_id === tenantId) || null; }
  async findById(tenantId, id) { return this.store.find(x => x.tenant_id === tenantId && x.id === id) || null; }
  async create(tenantId, fields) { const row = { id: `employee-${this.store.length + 1}`, tenant_id: tenantId, lifecycle_status: 'draft', ...fields }; this.store.push(row); return row; }
  async update(tenantId, id, fields) { const row = await this.findById(tenantId, id); if (!row) return null; Object.assign(row, fields); return row; }
  async activate(tenantId, id) { return this.update(tenantId, id, { lifecycle_status: 'active', activated_at: new Date().toISOString(), setup_step: 'complete' }); }
}
class InMemoryTenantIntegrationRepository {
  constructor(store = []) { this.store = store || []; }
  async list(tenantId) { return this.store.filter(x => x.tenant_id === tenantId); }
  async findByProvider(tenantId, provider) { return this.store.find(x => x.tenant_id === tenantId && x.provider === provider) || null; }
  async upsert(tenantId, fields) { const existing = await this.findByProvider(tenantId, fields.provider); const row = existing || { id: `integration-${this.store.length + 1}`, tenant_id: tenantId, created_at: new Date().toISOString() }; Object.assign(row, fields, { tenant_id: tenantId, updated_at: new Date().toISOString() }); if (!existing) this.store.push(row); return row; }
  async disconnect(tenantId, provider) { return this.upsert(tenantId, { provider, display_name: provider, status: 'disconnected', credential_reference: null, scopes: [] }); }
}

class InMemoryApprovalRepository {
  constructor(store = []) { this.store = store || []; }
  async list(tenantId) { return this.store.filter(x => x.tenant_id === tenantId).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
  async create(input) {
    const row = {
      id: `approval-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...input,
    };
    this.store.push(row);
    return { ...row };
  }
  async findById(tenantId, id) { return this.store.find(x => x.tenant_id === tenantId && x.id === id) || null; }
  async findByTaskId(tenantId, taskId) { return this.store.find(x => x.tenant_id === tenantId && x.task_id === taskId) || null; }
  async updateStatus(tenantId, id, status, reviewedBy = null, reviewNote = null) {
    const row = await this.findById(tenantId, id);
    if (!row) return null;
    Object.assign(row, { status, reviewed_by: reviewedBy, review_note: reviewNote, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { ...row };
  }
}
