import { BaseWorker } from './BaseWorker.js';

export class EmailTriageWorker extends BaseWorker {
  constructor({ providerName = 'groq', gmailProvider, queueService, memoryRepository } = {}) { super({ taskType: 'email_triage', providerName }); this.gmailProvider = gmailProvider; this.queueService = queueService; this.memoryRepository = memoryRepository; }
  normalizePayload(payload = {}) {
    // The scheduler submits a polling task with only the tenant's encrypted
    // credential reference. Individual Gmail messages are normalized into
    // child tasks below and must carry message_id.
    if (!payload.credential_reference) throw new Error('Email triage requires a credential reference.');
    if (payload.message_id && (!payload.sender || !payload.subject)) {
      throw new Error('Email triage message tasks require sender and subject.');
    }
    return payload;
  }
  async execute({ provider, payload, task, queueService, memoryRepository, employeeId }) {
    const memories = memoryRepository || this.memoryRepository;
    if (!payload.message_id && this.gmailProvider?.listUnread) {
      const listing = await this.gmailProvider.listUnread({ credentialReference: payload.credential_reference, maxResults: 25 });
      const messages = listing?.messages || [];
      const queued = [];
      if (!queueService) throw new Error('Email triage queue service is not configured.');
      for (const item of messages) {
        const email = await this.gmailProvider.getMessage({ credentialReference: payload.credential_reference, messageId: item.id });
        const normalized = normalizeGmailMessage(email);
        queued.push(await queueService.enqueueTask({ tenant_id: task.tenant_id, client_profile_id: task.client_profile_id ?? null, task_type: 'email_triage', idempotency_key: `email_triage_${item.id}`, payload: { ...payload, ...normalized, message_id: item.id, message: normalized.body } }));
      }
      return { provider: this.providerName, output: { status: 'completed', content: `Queued ${queued.length} unread email(s).`, queued_count: queued.length } };
    }
    let decision = payload.classification;
    if (!decision) {
      const result = await provider.execute({ prompt: 'Analyze this email and return JSON only, no other text: { "requires_response": true/false, "category": "customer_support|inquiry|spam|internal" }', payload: { message: payload.body || payload.message || '' }, task });
      const raw = result?.output?.content || result?.output?.text || result?.content || '{}';
      decision = typeof raw === 'string' ? JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '').trim()) : raw;
    }
    if (!decision.requires_response && this.gmailProvider?.markRead) {
      await this.gmailProvider.markRead(payload.credential_reference, payload.message_id);
      if (memories && employeeId) await memories.create({ employee_id: employeeId, task_id: task.id, memory_type: 'email_skipped', source: 'email', thread_id: payload.thread_id || null, content: `Skipped email from ${payload.sender || 'unknown'}: ${payload.subject || ''}`, metadata: { category: decision.category || null, message_id: payload.message_id } });
    }
    if (decision.requires_response && queueService) {
      await queueService.enqueueTask({
        tenant_id: task.tenant_id,
        client_profile_id: task.client_profile_id ?? null,
        task_type: 'email_response',
        idempotency_key: `email_response_${payload.message_id}`,
        payload: { ...payload, message: payload.body || '', classification: decision },
      });
    }
    return { provider: this.providerName, output: { status: 'completed', content: JSON.stringify(decision), triage: decision } };
  }
}

function normalizeGmailMessage(message = {}) {
  const headers = Object.fromEntries((message.payload?.headers || []).map(header => [String(header.name).toLowerCase(), header.value]));
  return { thread_id: message.threadId || null, sender: headers.from || '', subject: headers.subject || '', body: message.snippet || '' };
}
