/**
 * SupabaseSOPRepository.js
 *
 * Standard Operating Procedures — used by SOPService to load prompts.
 *
 * Table: sops
 *
 *   id uuid primary key default gen_random_uuid()
 *   tenant_id text not null
 *   task_type text not null
 *   version int not null default 1
 *   is_active boolean not null default true
 *   model_provider text not null default 'openai'
 *   system_prompt text not null
 *   input_schema jsonb default '{}'
 *   created_at timestamptz not null default now()
 *   updated_at timestamptz not null default now()
 */
export class SupabaseSOPRepository {
  constructor(supabase) {
    this.db = supabase;
  }

  async findActiveByTaskType({ tenantId, taskType }) {
    const { data, error } = await this.db
      .from('client_sops')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('task_type', taskType)
      .eq('active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async findLatestVersion({ tenantId, taskType }) {
    const { data, error } = await this.db
      .from('client_sops')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('task_type', taskType)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async ensureDefaultChat({ tenantId, clientProfileId } = {}) {
    const existing = await this.findActiveByTaskType({ tenantId, taskType: 'chat' });
    if (existing) return existing;
    const { data, error } = await this.db.from('client_sops').insert({
      tenant_id: tenantId,
      client_profile_id: clientProfileId ?? null,
      name: 'Default client chat',
      task_type: 'chat',
      version: 1,
      active: true,
      system_prompt: `You write client-facing B2B business emails for Ikamva. Write as a professional, direct, human colleague tailored to the recipient. Never use Markdown tables, pipe characters, bullets, raw Markdown syntax, bolding, or headers. Never include meta-chatter, greeting wrappers, chatbot introductions, capability summaries, or phrases such as "Here is the email draft" or "I can help you with". Return only the email subject and body as string fields. Use plain text or clean standard email HTML paragraphs with natural spacing. Begin directly with the appropriate greeting or body and end with a proper business sign-off.`,
      validation_schema: { required: ['message'] },
      output_schema: { type: 'object', required: ['content'] },
      model_provider: 'openai',
      model_name: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      model_settings: {},
    }).select().single();
    if (error) throw error;
    return data;
  }

  async ensureDefaultEmailWorkflow({ tenantId, clientProfileId, taskType } = {}) {
    const existing = await this.findActiveByTaskType({ tenantId, taskType });
    if (existing) return existing;
    const prompts = { email_triage: 'Return JSON only: { "requires_response": true/false, "category": "customer_support|inquiry|spam|internal" }', email_response: 'Draft a professional business email response using the supplied Employee configuration and company context.' };
    const { data, error } = await this.db.from('client_sops').insert({ tenant_id: tenantId, client_profile_id: clientProfileId ?? null, name: `Default ${taskType}`, task_type: taskType, version: 1, active: true, system_prompt: prompts[taskType], validation_schema: { required: ['message'] }, output_schema: { type: 'object' }, model_provider: 'groq', model_name: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', model_settings: {} }).select().single();
    if (error) throw error;
    return data;
  }
}
