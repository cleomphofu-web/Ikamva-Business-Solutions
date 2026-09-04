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
}
