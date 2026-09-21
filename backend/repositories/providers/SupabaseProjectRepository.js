export class SupabaseProjectRepository {
  constructor(supabase) { this.db = supabase; }
  async list(tenantId) { const { data, error } = await this.db.from('crm_projects').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false }); if (error) throw error; return data || []; }
  async listAll() { const { data, error } = await this.db.from('crm_projects').select('*').order('updated_at', { ascending: false }); if (error) throw error; return data || []; }
  async create(input) { const { data, error } = await this.db.from('crm_projects').insert(input).select().single(); if (error) throw error; return data; }
  async update(id, tenantId, input) { const { data, error } = await this.db.from('crm_projects').update(input).eq('id', id).eq('tenant_id', tenantId).select().single(); if (error) throw error; return data; }
  async delete(id, tenantId) { const { data, error } = await this.db.from('crm_projects').delete().eq('id', id).eq('tenant_id', tenantId).select().maybeSingle(); if (error) throw error; return data || null; }
}
