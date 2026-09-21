export class InMemoryCompanyKnowledgeRepository {
  constructor(store = []) { this.store = store || []; }

  async createChunks(tenantId, chunks) {
    const rows = chunks.map((chunk, index) => ({
      id: `knowledge-${this.store.length + index + 1}`,
      tenant_id: tenantId,
      active: true,
      created_at: new Date().toISOString(),
      ...chunk,
    }));
    this.store.push(...rows);
    return rows;
  }

  async listMissingEmbeddings(limit = 1000) {
    return this.store.filter(row => row.active && !row.embedding).slice(0, limit);
  }

  async updateEmbedding(tenantId, id, embedding) {
    const row = this.store.find(item => item.tenant_id === tenantId && item.id === id);
    if (!row) return null;
    row.embedding = embedding;
    return row;
  }

  /**
   * Semantic search stub — in-memory implementation cannot perform real vector
   * similarity. Returns keyword-ranked results as a fallback so tests can
   * exercise the full retrieval path without an embedding API.
   *
   * @param {string} tenantId
   * @param {number[]} _embedding  - Ignored in this implementation
   * @param {number}   limit
   * @param {object}   [options]
   * @param {string[]} [options.sourceFilter]  - Restrict to chunks from these source filenames
   */
  async searchByEmbedding(tenantId, _embedding, limit = 3, { sourceFilter } = {}) {
    // Fall through to keyword search so the in-memory path is still useful in tests
    return this.search(tenantId, '', limit, { sourceFilter });
  }

  /**
   * Keyword (BM25-style) search scoped to a single tenant.
   *
   * @param {string}   tenantId
   * @param {string}   query
   * @param {number}   limit
   * @param {object}   [options]
   * @param {string[]} [options.sourceFilter]  - Restrict to chunks from these source filenames
   */
  async search(tenantId, query, limit = 3, { sourceFilter } = {}) {
    let rows = this.store.filter(row => row.tenant_id === tenantId && row.active);
    if (sourceFilter && sourceFilter.length > 0) {
      rows = rows.filter(row => sourceFilter.includes(row.source));
    }
    if (!query || !query.trim()) return rows.slice(0, limit);
    const terms = String(query).toLowerCase().split(/\W+/).filter(term => term.length > 2);
    return rows
      .map(row => ({ row, score: terms.filter(term => String(row.content).toLowerCase().includes(term)).length }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.row);
  }

  async list(tenantId, limit = 100) {
    return this.store.filter(row => row.tenant_id === tenantId && row.active).slice(0, limit);
  }
}
