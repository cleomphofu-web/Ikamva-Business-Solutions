export class InMemoryLeadRepository {
  constructor({ store = new Map(), clock = () => new Date() } = {}) { this.leads = store; this.clock = clock; }
  async list(tenantId) { return [...this.leads.values()].filter(x => x.tenant_id === tenantId).map(x => ({ ...x })); }
  async listAll() { return [...this.leads.values()].map(x => ({ ...x })); }
  async upsert(input) { const existing = input.id ? this.leads.get(input.id) : [...this.leads.values()].find(x => x.tenant_id === input.tenant_id && x.email === input.email); const now = this.clock().toISOString(); const lead = { id: existing?.id || input.id || `lead-${this.leads.size + 1}`, created_at: existing?.created_at || now, updated_at: now, ...existing, ...input }; this.leads.set(lead.id, lead); return { ...lead }; }
  async create(input) { return this.upsert(input); }
  async update(id, tenantId, input) { const existing = this.leads.get(id); if (!existing || existing.tenant_id !== tenantId) return null; return this.upsert({ ...existing, ...input, id, tenant_id: tenantId }); }
  async delete(id, tenantId) { const x = this.leads.get(id); if (!x || x.tenant_id !== tenantId) return null; this.leads.delete(id); return { ...x }; }
}
