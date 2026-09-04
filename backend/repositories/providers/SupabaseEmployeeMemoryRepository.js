export class SupabaseEmployeeMemoryRepository {
  constructor(supabase) { this.db = supabase; }
  async listByEmployee(tenantId, employeeId, { limit = 20, offset = 0, threadId } = {}) {
    let query = this.db.from('ai_employee_memory').select('*').eq('tenant_id', tenantId).eq('employee_id', employeeId);
    if (threadId) query = query.eq('thread_id', threadId);
    const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error; return data || [];
  }
  async create(tenantId, input) { const { data, error } = await this.db.from('ai_employee_memory').insert({ ...input, tenant_id: tenantId }).select().single(); if (error) throw error; return data; }
}
