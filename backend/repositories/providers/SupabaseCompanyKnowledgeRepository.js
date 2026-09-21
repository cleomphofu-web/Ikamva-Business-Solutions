import { reportJsonWriteFailure } from '../../lib/db-write-diagnostics.js';

export class SupabaseCompanyKnowledgeRepository {
  constructor(supabase) { this.db = supabase; }

  async createChunks(tenantId, chunks) {
    const rows = chunks.map(chunk => ({ ...chunk, tenant_id: tenantId }));
    try {
      const { data, error } = await this.db.from('company_knowledge').insert(rows).select();
      if (error) { reportJsonWriteFailure('company_knowledge.content insert', rows, error); throw error; }
      return data || [];
    } catch (error) {
      reportJsonWriteFailure('company_knowledge.content insert', rows, error);
      throw error;
    }
  }

  async listMissingEmbeddings(limit = 1000) {
    const { data, error } = await this.db
      .from('company_knowledge').select('id, tenant_id, content')
      .is('embedding', null).eq('active', true).limit(limit);
    if (error) throw error;
    return data || [];
  }

  async updateEmbedding(tenantId, id, embedding) {
    const row = { embedding };
    try {
      const { data, error } = await this.db
        .from('company_knowledge').update(row)
        .eq('tenant_id', tenantId).eq('id', id).select().single();
      if (error) { reportJsonWriteFailure('company_knowledge.embedding update', row, error); throw error; }
      return data;
    } catch (error) {
      reportJsonWriteFailure('company_knowledge.embedding update', row, error);
      throw error;
    }
  }

  /**
   * Vector similarity search via the `match_company_knowledge` RPC.
   *
   * @param {string}   tenantId
   * @param {number[]} embedding
   * @param {number}   limit
   * @param {object}   [options]
   * @param {string[]} [options.sourceFilter]  - Restrict to these source filenames (null = no filter)
   */
  async searchByEmbedding(tenantId, embedding, limit = 3, { sourceFilter } = {}) {
    const { data, error } = await this.db.rpc('match_company_knowledge', {
      query_embedding: embedding,
      match_tenant_id: tenantId,
      match_count: limit,
      source_filter: sourceFilter && sourceFilter.length > 0 ? sourceFilter : null,
    });
    if (error) throw error;
    return data || [];
  }

  /**
   * Keyword search (BM25-style, application-side scoring).
   *
   * @param {string}   tenantId
   * @param {string}   query
   * @param {number}   limit
   * @param {object}   [options]
   * @param {string[]} [options.sourceFilter]  - Restrict to these source filenames
   */
  async search(tenantId, query, limit = 3, { sourceFilter } = {}) {
    let qb = this.db
      .from('company_knowledge').select('*')
      .eq('tenant_id', tenantId).eq('active', true)
      .order('updated_at', { ascending: false }).limit(100);
    if (sourceFilter && sourceFilter.length > 0) {
      qb = qb.in('source', sourceFilter);
    }
    const { data, error } = await qb;
    if (error) throw error;

    const terms = String(query || '').toLowerCase().split(/\W+/).filter(term => term.length > 2);
    if (!terms.length) return (data || []).slice(0, limit);

    return (data || [])
      .map(row => ({ row, score: terms.reduce((s, t) => s + (String(row.content).toLowerCase().includes(t) ? 1 : 0), 0) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.row);
  }

  async list(tenantId, limit = 100) {
    const { data, error } = await this.db
      .from('company_knowledge').select('*')
      .eq('tenant_id', tenantId).eq('active', true)
      .order('updated_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  }
}
