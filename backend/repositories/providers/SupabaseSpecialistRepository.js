export class SupabaseSpecialistRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async listByEmployee(tenantId, employeeId) {
    const { data, error } = await this.supabase
      .from('ai_employee_specialists')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async findByType(tenantId, employeeId, specialistType) {
    const { data, error } = await this.supabase
      .from('ai_employee_specialists')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('specialist_type', specialistType)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async create(tenantId, fields) {
    const { data, error } = await this.supabase
      .from('ai_employee_specialists')
      .upsert({ ...fields, tenant_id: tenantId, updated_at: new Date().toISOString() }, { onConflict: 'employee_id,specialist_type' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(tenantId, id, fields) {
    const { data, error } = await this.supabase
      .from('ai_employee_specialists')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
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
