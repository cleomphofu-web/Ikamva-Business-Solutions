import { BaseWorker } from './BaseWorker.js';

export class ChainStepWorker extends BaseWorker {
  constructor({ taskType, providerName = 'mock' }) { super({ taskType, providerName }); }
  normalizePayload(payload = {}) { return payload; }

  async execute({ provider, payload, task, prompt, companyKnowledgeRepository, contactRepository, gmailMessageService, approvalRepository, tenantRepository, employee, providerRegistry }) {
    const context = { ...(payload.chain_context || {}) };
    if (this.taskType === 'email_read') {
      return completed(this.providerName, { sender: payload.sender, subject: payload.subject, body: payload.body || payload.message || '', thread_id: payload.thread_id });
    }
    if (this.taskType === 'crm_lookup') {
      const contact = contactRepository?.findByEmail ? await contactRepository.findByEmail(context.sender, task.tenant_id) : null;
      return completed(this.providerName, contact ? { customer_name: contact.name || contact.full_name, company: contact.company || contact.company_name, account_tier: contact.account_tier || contact.tier } : { is_new_lead: true });
    }
    if (this.taskType === 'quote_generate') {
      const body = context.body || payload.body || '';
      const jobSpec = employee?.configuration?.job_spec || {};
      const sourceFilter = Array.isArray(jobSpec.knowledge_sources) && jobSpec.knowledge_sources.length > 0
        ? jobSpec.knowledge_sources : undefined;
      const chunks = companyKnowledgeRepository?.search
        ? await companyKnowledgeRepository.search(task.tenant_id, body, 3, { sourceFilter })
        : [];

      const quotePrompt = `${prompt}\n\nCompany Brain pricing context:\n${chunks.map(chunk => chunk.content).join('\n')}\n\nChain context:\n${JSON.stringify(context)}\n\nProduce a structured quote in plain prose with what was requested, an itemised price breakdown, a VAT line, delivery estimate, and quote validity period.`;
      const result = process.env.MOCK_GMAIL === 'true' ? { provider: 'mock', output: { content: `Quote requested: ${context.subject || body}\nItemised price breakdown: 50 premium package units at R100.00 each = R5,000.00\nVAT (15%): R750.00\nDelivery estimate: 5 business days to Johannesburg\nQuote validity: 30 days.` } } : await provider.execute({ prompt: quotePrompt, payload: { message: body }, task });
      return completed(result?.provider || this.providerName, { quote_content: result?.output?.content || result?.content || '' });
    }
    if (this.taskType === 'support_response') {
      const result = await provider.execute({ prompt: `${prompt}\n\nRespond to this customer support email with a concise, helpful answer. Do not claim actions you cannot perform.`, payload: { message: context.body || payload.body || '' }, task });
      return completed(result?.provider || this.providerName, { support_content: result?.output?.content || result?.content || '' });
    }
    if (this.taskType === 'lead_capture') {
      const email = context.sender || payload.sender;
      const name = email ? email.split('@')[0] : 'Unknown';
      if (email && contactRepository?.upsert) {
        await contactRepository.upsert({ tenant_id: task.tenant_id, email, name, source: 'lead_capture' });
      }
      return completed(this.providerName, { lead_capture: true, lead_email: email || null, lead_subject: context.subject || payload.subject || null });
    }
    if (this.taskType === 'crm_update') {
      const email = context.sender || payload.sender;
      const name = email ? email.split('@')[0] : 'Unknown';
      if (email && contactRepository?.upsert) {
        await contactRepository.upsert({ tenant_id: task.tenant_id, email, name, source: 'crm_update' });
      }
      return completed(this.providerName, { crm_update: true, customer_email: email || null, note: context.body || payload.body || '' });
    }
    if (this.taskType === 'email_draft') {
      const companyName = employee?.configuration?.company_name || 'Your company';
      const content = `Dear ${context.customer_name || context.sender || 'Customer'},\n\n${context.quote_content || context.support_content || ''}\n\nKind regards,\n${employee?.name || 'Your Employee'}\n${companyName}`;
      const draft = await gmailMessageService.createDraft(payload.credential_reference, { threadId: context.thread_id, raw: Buffer.from(`To: ${context.sender}\r\nSubject: Quote for ${context.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${content}`).toString('base64url') });
      return completed('gmail-mcp', { draft_id: draft.id, draft_preview: content.slice(0, 1000) });
    }
    if (this.taskType === 'approval_gate') {
      const action = { draft_id: context.draft_id, to: context.sender || payload.sender, subject: context.subject || payload.subject, thread_id: context.thread_id, draft_preview: context.draft_preview };
      // By returning 'awaiting_approval' in output (not wrapped in chain_context), WorkerEngine will natively park it.
      return { provider: this.providerName, output: { status: 'awaiting_approval', action, content: context.draft_preview } };
    }
    if (this.taskType === 'email_send') {
      // The actual send is handled natively by WorkerEngine.js's resumeApprovedTask when the approval_gate resumes.
      // This step just marks the end of the chain.
      return completed(this.providerName, { sent: true });
    }
    return completed(this.providerName, {});
  }
}

function completed(provider, chain_context) { return { provider, output: { status: 'completed', chain_context } }; }
