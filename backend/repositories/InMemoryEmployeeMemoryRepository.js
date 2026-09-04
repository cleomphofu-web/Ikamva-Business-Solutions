export class InMemoryEmployeeMemoryRepository {
  constructor(store = []) { this.store = store || []; }
  async listByEmployee(tenantId, employeeId, { limit = 20, offset = 0, threadId } = {}) { return this.store.filter(x => x.tenant_id === tenantId && x.employee_id === employeeId && (!threadId || x.thread_id === threadId)).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at))).slice(offset, offset + limit); }
  async create(tenantId, input) { const row = { id: `memory-${this.store.length + 1}`, tenant_id: tenantId, created_at: new Date().toISOString(), ...input }; this.store.push(row); return row; }
}
