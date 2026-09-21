export class SupabaseContactNoteRepository {
  constructor(supabase) { this.db = supabase; }
  async listByContact(contactId, tenantId) { const { data, error } = await this.db.from('crm_contact_notes').select('*').eq('contact_id', contactId).eq('tenant_id', tenantId).order('created_at', { ascending: false }); if (error) throw error; return data ?? []; }
  async create(input) { const { data, error } = await this.db.from('crm_contact_notes').insert(input).select().single(); if (error) throw error; return data; }
  async delete(id, tenantId) { const { data, error } = await this.db.from('crm_contact_notes').delete().eq('id', id).eq('tenant_id', tenantId).select().maybeSingle(); if (error) throw error; return data ?? null; }
}
