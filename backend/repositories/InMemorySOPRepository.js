export class InMemorySOPRepository {
  constructor(sops = []) {
    this.sops = [...sops];
  }

  async findActiveByTaskType({ tenantId, taskType }) {
    return this.sops.find(sop => (
      sop.tenant_id === tenantId && sop.task_type === taskType && sop.active
    )) || null;
  }

  async findLatestVersion({ tenantId, taskType }) {
    return this.sops
      .filter(sop => sop.tenant_id === tenantId && sop.task_type === taskType)
      .sort((a, b) => b.version - a.version)[0] || null;
  }

  async ensureDefaultChat({ tenantId, clientProfileId } = {}) {
    const existing = await this.findActiveByTaskType({ tenantId, taskType: 'chat' });
    if (existing) return existing;
    const sop = { id: `sop-${this.sops.length + 1}`, tenant_id: tenantId, client_profile_id: clientProfileId ?? null, name: 'Default client chat', task_type: 'chat', version: 1, active: true, system_prompt: 'You are a helpful Ikamva AI employee.', validation_schema: { required: ['message'] }, model_provider: 'openai' };
    this.sops.push(sop);
    return sop;
  }

  async ensureDefaultEmailWorkflow({ tenantId, clientProfileId, taskType } = {}) {
    const existing = await this.findActiveByTaskType({ tenantId, taskType });
    if (existing) return existing;
    const sop = { id: `sop-${this.sops.length + 1}`, tenant_id: tenantId, client_profile_id: clientProfileId ?? null, name: `Default ${taskType}`, task_type: taskType, version: 1, active: true, system_prompt: taskType === 'email_triage' ? 'Return JSON only.' : 'Draft a professional business email response.', validation_schema: { required: ['message'] }, model_provider: 'groq' };
    this.sops.push(sop);
    return sop;
  }

  async ensureDefaultShiftStart({ tenantId, clientProfileId } = {}) {
    const existing = await this.findActiveByTaskType({ tenantId, taskType: 'shift_start' });
    if (existing) return existing;
    const sop = {
      id: `sop-${this.sops.length + 1}`,
      tenant_id: tenantId,
      client_profile_id: clientProfileId ?? null,
      name: 'Morning Shift Standup & Briefing',
      task_type: 'shift_start',
      version: 1,
      active: true,
      system_prompt: 'Review live specialist status, overnight operations, and pending approvals. Produce a concise, executive morning briefing for the account owner highlighting pending actions and needs_attention flags.',
      validation_schema: { required: [] },
      model_provider: 'groq',
    };
    this.sops.push(sop);
    return sop;
  }
}

