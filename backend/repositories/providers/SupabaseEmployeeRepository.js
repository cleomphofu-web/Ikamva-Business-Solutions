import { reportJsonWriteFailure } from '../../lib/db-write-diagnostics.js';
export class SupabaseEmployeeRepository {
  constructor(supabase) { this.db = supabase; }
  async findByTenant(tenantId) { const { data, error } = await this.db.from('ai_employees').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false, nullsFirst: false }).limit(1); if (error) throw error; return data?.[0] ?? null; }
  async findById(tenantId, id) { const { data, error } = await this.db.from('ai_employees').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle(); if (error) throw error; return data ?? null; }
  async create(tenantId, fields) { const row = { ...fields, tenant_id: tenantId }; try { const { data, error } = await this.db.from('ai_employees').insert(row).select().single(); if (error) { reportJsonWriteFailure('ai_employees.configuration insert', row, error); throw error; } return data; } catch (error) { reportJsonWriteFailure('ai_employees.configuration insert', row, error); throw error; } }
  async update(tenantId, id, fields) { const row = { ...fields, updated_at: new Date().toISOString() }; try { const { data, error } = await this.db.from('ai_employees').update(row).eq('tenant_id', tenantId).eq('id', id).select().single(); if (error) { reportJsonWriteFailure('ai_employees.configuration update', row, error); throw error; } return data; } catch (error) { reportJsonWriteFailure('ai_employees.configuration update', row, error); throw error; } }
  async activate(tenantId, id) { return this.update(tenantId, id, { lifecycle_status: 'active', activated_at: new Date().toISOString(), setup_step: 'complete' }); }
}
