export class InMemoryCompanyKnowledgeRepository {
  constructor(store = []) { this.store = store || []; }
  async createChunks(tenantId, chunks) { const rows = chunks.map((chunk, index) => ({ id: `knowledge-${this.store.length + index + 1}`, tenant_id: tenantId, active: true, created_at: new Date().toISOString(), ...chunk })); this.store.push(...rows); return rows; }
  async listMissingEmbeddings(limit = 1000) { return this.store.filter(row => row.active && !row.embedding).slice(0, limit); }
  async updateEmbedding(tenantId, id, embedding) { const row = this.store.find(item => item.tenant_id === tenantId && item.id === id); if (!row) return null; row.embedding = embedding; return row; }
  async searchByEmbedding() { return []; }
  async list(tenantId, limit = 100) { return this.store.filter(row => row.tenant_id === tenantId && row.active).slice(0, limit); }
  async search(tenantId, query, limit = 3) { const terms = String(query || '').toLowerCase().split(/\W+/).filter(term => term.length > 2); return this.store.map(row => ({ row, score: terms.filter(term => String(row.content).toLowerCase().includes(term)).length })).filter(x => x.row.tenant_id === tenantId && x.score > 0).sort((a,b) => b.score-a.score).slice(0, limit).map(x => x.row); }
}
