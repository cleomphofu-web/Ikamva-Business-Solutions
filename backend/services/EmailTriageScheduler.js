export class EmailTriageScheduler {
  constructor({ tenantRepository, employeeRepository, integrationRepository, queueService, clock = () => new Date(), logger = console } = {}) { this.tenants = tenantRepository; this.employees = employeeRepository; this.integrations = integrationRepository; this.queue = queueService; this.clock = clock; this.logger = logger; }
  async enqueueForTenant(tenantId) {
    const employee = await this.employees.findByTenant(tenantId);
    const integration = await this.integrations.findByProvider(tenantId, 'gmail');
    if (!employee || employee.lifecycle_status !== 'active' || integration?.status !== 'connected' || !integration.credential_reference) return null;
    return this.queue.enqueueTask({ tenant_id: tenantId, task_type: 'email_triage', idempotency_key: `email_triage_${this.clock().toISOString().slice(0, 16)}`, payload: { credential_reference: integration.credential_reference } });
  }
  async tick(tenantIds = []) { let count = 0; for (const tenantId of tenantIds) if (await this.enqueueForTenant(tenantId)) count += 1; this.logger.info(`[email-triage] enqueued ${count} tenant poll task(s)`); return count; }
}
