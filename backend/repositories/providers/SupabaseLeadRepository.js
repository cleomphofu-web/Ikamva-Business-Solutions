export class SupabaseLeadRepository {
  constructor(supabase) { this.db = supabase; }
  async list(tenantId) { const { data, error } = await this.db.from('crm_leads').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false }); if (error) throw error; return data ?? []; }
  async listAll() { const { data, error } = await this.db.from('crm_leads').select('*').order('updated_at', { ascending: false }); if (error) throw error; return data ?? []; }
  async upsert(input) { const { data, error } = await this.db.from('crm_leads').upsert({ ...input, tenant_id: input.tenant_id }, { onConflict: 'tenant_id,email' }).select().single(); if (error) throw error; return data; }
  async delete(id, tenantId) { const { data, error } = await this.db.from('crm_leads').delete().eq('id', id).eq('tenant_id', tenantId).select().maybeSingle(); if (error) throw error; return data ?? null; }
}
