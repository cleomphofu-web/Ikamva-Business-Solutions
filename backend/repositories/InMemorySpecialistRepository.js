export class InMemorySpecialistRepository {
  constructor(store = []) {
    this.store = store || [];
  }

  async listByEmployee(tenantId, employeeId) {
    return this.store.filter(x => x.tenant_id === tenantId && x.employee_id === employeeId);
  }

  async findByType(tenantId, employeeId, specialistType) {
    return this.store.find(x => x.tenant_id === tenantId && x.employee_id === employeeId && x.specialist_type === specialistType) || null;
  }

  async create(tenantId, fields) {
    const existing = await this.findByType(tenantId, fields.employee_id, fields.specialist_type);
    if (existing) {
      Object.assign(existing, fields, { updated_at: new Date().toISOString() });
      return existing;
    }
    const row = {
      id: `specialist-${this.store.length + 1}`,
      tenant_id: tenantId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...fields,
    };
    this.store.push(row);
    return row;
  }

  async update(tenantId, id, fields) {
    const row = this.store.find(x => x.tenant_id === tenantId && x.id === id);
    if (!row) return null;
    Object.assign(row, fields, { updated_at: new Date().toISOString() });
    return row;
  }

  async seedDefaults(tenantId, employeeId, integrations = []) {
    const crmConnected = integrations.some(i => (i.provider === 'hubspot' || i.provider === 'crm') && i.status === 'connected');
    const defaults = [
      {
        employee_id: employeeId,
        specialist_type: 'sales',
        display_name: 'Sales Specialist',
        enabled: true,
        config: { description: 'Handles quote generation and pricing inquiries.' },
      },
      {
        employee_id: employeeId,
        specialist_type: 'support',
        display_name: 'Customer Support Specialist',
        enabled: true,
        config: { description: 'Triages customer emails and drafts support replies.' },
      },
      {
        employee_id: employeeId,
        specialist_type: 'crm',
        display_name: 'CRM Specialist',
        enabled: crmConnected,
        config: { description: 'Updates customer records and contact notes.' },
      },
      {
        employee_id: employeeId,
        specialist_type: 'lead_capture',
        display_name: 'Lead Capture Specialist',
        enabled: false,
        config: { description: 'Captures and qualifies inbound sales leads.' },
      },
      {
        employee_id: employeeId,
        specialist_type: 'data_analysis',
        display_name: 'Data Analysis Specialist',
        enabled: false,
        config: { status: 'not_yet_available', description: 'Advanced reporting and business intelligence.' },
      },
    ];

    const results = [];
    for (const item of defaults) {
      results.push(await this.create(tenantId, item));
    }
    return results;
  }
}
