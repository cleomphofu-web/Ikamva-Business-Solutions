export class SupabaseApprovalRepository {
  constructor(supabase) { this.db = supabase; }

  async list(tenantId) {
    const { data, error } = await this.db
      .from('approval_queue')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async create(input) {
    const { data, error } = await this.db
      .from('approval_queue')
      .insert({
        tenant_id:         input.tenant_id,
        task_id:           input.task_id,
        employee_id:       input.employee_id ?? null,
        action:            input.action,
        action_payload:    input.action_payload ?? {},
        reasoning_summary: input.reasoning_summary ?? '',
        status:            'pending',
        requested_by:      input.requested_by ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findById(tenantId, id) {
    const { data, error } = await this.db
      .from('approval_queue')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async findByTaskId(tenantId, taskId) {
    const { data, error } = await this.db
      .from('approval_queue')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async updateStatus(tenantId, id, status, reviewedBy = null, reviewNote = null) {
    const { data, error } = await this.db
      .from('approval_queue')
      .update({
        status,
        reviewed_by:  reviewedBy,
        review_note:  reviewNote,
        reviewed_at:  new Date().toISOString(),
        updated_at:   new Date().toISOString(),
        updated_date: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }
}
