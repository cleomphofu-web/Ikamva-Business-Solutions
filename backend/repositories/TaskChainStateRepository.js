export class TaskChainStateRepository {
  constructor(db, tenantId) { this.db = db; this.tenantId = tenantId; }
  async upsert(input) {
    const { data, error } = await this.db.from('task_chains').upsert({ ...input, tenant_id: this.tenantId, updated_at: new Date().toISOString() }, { onConflict: 'parent_task_id' }).select().single();
    if (error) throw error;
    return data;
  }
}
