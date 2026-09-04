export class SupabaseContactRepository {
  constructor(supabase) { this.db = supabase; }

  async findById(id, tenantId) {
    const { data, error } = await this.db.from('crm_contacts').select('*').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async list(tenantId) {
    const { data, error } = await this.db.from('crm_contacts').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listAll() {
    const { data, error } = await this.db.from('crm_contacts').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async upsert(input) {
    const { data, error } = await this.db.from('crm_contacts').upsert({
      tenant_id: input.tenant_id,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      company: input.company ?? null,
      source: input.source ?? 'manual',
    }, { onConflict: 'tenant_id,email' }).select().single();
    if (error) throw error;
    return data;
  }
}
