export class SupabaseEmployeeActivityLogRepository {
  constructor(supabase) { this.db = supabase; }

  async append(input) {
    const { data, error } = await this.db
      .from('employee_activity_logs')
      .insert({
        tenant_id: input.tenant_id,
        employee_id: input.employee_id ?? null,
        task_id: input.task_id ?? null,
        action: input.action,
        token_usage: input.token_usage ?? null,
        estimated_cost: input.estimated_cost ?? null,
        result: input.result ?? null,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async list({ tenantId, limit = 50 } = {}) {
    let query = this.db.from('employee_activity_logs').select('*').order('occurred_at', { ascending: false }).limit(limit);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }
}
