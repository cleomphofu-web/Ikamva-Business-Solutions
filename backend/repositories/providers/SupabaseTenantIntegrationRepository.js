export class SupabaseTenantIntegrationRepository {
  constructor(supabase) { this.db = supabase; }
  async list(tenantId) {
    const { data, error } = await this.db.from('tenant_integrations').select('id, provider, display_name, status, scopes, created_at, updated_at').eq('tenant_id', tenantId).order('display_name');
    if (error) throw error;
    return data ?? [];
  }
  async listByProvider(provider) { const { data, error } = await this.db.from('tenant_integrations').select('*').eq('provider', provider).eq('status', 'connected'); if (error) throw error; return data || []; }
  async findByProvider(tenantId, provider) {
    const { data, error } = await this.db.from('tenant_integrations').select('*').eq('tenant_id', tenantId).eq('provider', provider).maybeSingle();
    if (error) throw error;
    return data;
  }
  async upsert(tenantId, fields) {
    const existing = await this.findByProvider(tenantId, fields.provider);
    const query = existing
      ? this.db.from('tenant_integrations').update(fields).eq('tenant_id', tenantId).eq('provider', fields.provider)
      : this.db.from('tenant_integrations').insert({ ...fields, tenant_id: tenantId });
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
  }
  async disconnect(tenantId, provider) {
    return this.upsert(tenantId, { provider, display_name: provider === 'gmail' ? 'Gmail' : provider, status: 'disconnected', credential_reference: null, scopes: [] });
  }
}
