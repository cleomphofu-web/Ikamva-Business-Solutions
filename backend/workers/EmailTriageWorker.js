import { BaseWorker } from './BaseWorker.js';

export class EmailTriageWorker extends BaseWorker {
  constructor({ providerName = 'groq', gmailProvider, queueService, memoryRepository, taskChainService, specialistRepository } = {}) {
    super({ taskType: 'email_triage', providerName });
    this.gmailProvider = gmailProvider;
    this.queueService = queueService;
    this.memoryRepository = memoryRepository;
    this.taskChainService = taskChainService;
    this.specialistRepository = specialistRepository;
  }

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

  async execute({ provider, payload, task, queueService, memoryRepository, employeeId, taskChainService, quotesEnabled = false, specialistRepository, employee }) {
    const memories = memoryRepository || this.memoryRepository;
    const specialists = specialistRepository || this.specialistRepository;
    const mockMode = process.env.MOCK_GMAIL === 'true' || process.env.NODE_ENV === 'test';

    if (mockMode && payload.message_id && /quote|pricing|premium package/i.test(`${payload.subject || ''} ${payload.body || payload.message || ''}`)) {
      payload = { ...payload, classification: { requires_response: true, category: 'quote_request' } };
    }

    if (!payload.message_id && this.gmailProvider?.listUnread) {
      const listing = await this.gmailProvider.listUnread({ credentialReference: payload.credential_reference, maxResults: 25, tenantId: task.tenant_id });
      const messages = listing?.messages || [];
      const queued = [];
      if (!queueService) throw new Error('Email triage queue service is not configured.');
      for (const item of messages) {
        const email = await this.gmailProvider.getMessage({ credentialReference: payload.credential_reference, messageId: item.id, tenantId: task.tenant_id });
        const normalized = normalizeGmailMessage(email);
        queued.push(await queueService.enqueueEmailTriageTask({
          tenant_id: task.tenant_id,
          client_profile_id: task.client_profile_id ?? null,
          message_id: item.id,
          idempotency_key: `email_triage_${item.id}`,
          payload: { ...payload, ...normalized, message_id: item.id, message: normalized.body },
        }));
      }
      return { provider: this.providerName, output: { status: 'completed', content: `Queued ${queued.length} unread email(s).`, queued_count: queued.length } };
    }

    let decision = payload.classification;
    if (!decision && !mockMode) {
      const result = await provider.execute({
        prompt: 'Analyze this email and return JSON only, no other text: { "requires_response": true/false, "category": "quote_request|customer_support|inquiry|spam|internal" }',
        payload: { message: payload.body || payload.message || '' },
        task,
      });
      const raw = result?.output?.content || result?.output?.text || result?.content || '{}';
      decision = typeof raw === 'string' ? JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '').trim()) : raw;
    }

    if (mockMode && /quote|pricing|premium package/i.test(`${payload.subject || ''} ${payload.body || payload.message || ''}`)) {
      decision = { requires_response: true, category: 'quote_request' };
    }

    // ── Specialist Mapping & Availability Check ────────────────────────────
    const categoryToSpecialistType = {
      quote_request: 'sales',
      customer_support: 'support',
      inquiry: 'crm',
      lead: 'lead_capture',
    };

    const targetSpecialistType = categoryToSpecialistType[decision.category] || 'support';

    if (specialists && employeeId) {
      try {
        const specialist = await specialists.findByType(employeeId, targetSpecialistType);
        if (specialist && !specialist.enabled) {
          // Specialist capability is disabled: Send an honest holding reply as base Employee
          // and log a disabled-capability gap for the Manager.
          if (memories) {
            await memories.create({
              employee_id: employeeId,
              task_id: task.id,
              memory_type: 'disabled_capability_gap',
              source: 'system',
              thread_id: payload.thread_id || null,
              content: `Received ${decision.category} request from ${payload.sender || 'unknown'}, but the ${specialist.display_name} is currently disabled.`,
              metadata: { specialist_type: targetSpecialistType, category: decision.category, message_id: payload.message_id },
            });
          }

          if (decision.requires_response && queueService) {
            const companyName = employee?.configuration?.company_name || 'our company';
            const holdingBody = `Thank you for reaching out. We have received your inquiry regarding "${payload.subject || 'your request'}". Our team is reviewing it and will get back to you soon.\n\nKind regards,\n${employee?.name || 'Your AI Team'}\n${companyName}`;
            await queueService.enqueueTask({
              tenant_id: task.tenant_id,
              client_profile_id: task.client_profile_id ?? null,
              task_type: 'email_response',
              idempotency_key: `email_response_${payload.message_id}_disabled_holding`,
              payload: { ...payload, message: holdingBody, body: holdingBody, classification: { ...decision, holding_reply: true } },
            });
          }

          return {
            provider: this.providerName,
            output: {
              status: 'completed',
              content: `Specialist ${targetSpecialistType} is disabled. Logged gap and enqueued holding reply.`,
              specialist_disabled: true,
              specialist_type: targetSpecialistType,
              triage: decision,
            },
          };
        }
      } catch (specErr) {
        console.warn('[EmailTriageWorker] Specialist lookup failed:', specErr?.message);
      }
    }

    if ((decision.category === 'quote_request' || decision.category === 'customer_support' || decision.category === 'inquiry' || decision.category === 'lead') && (quotesEnabled || decision.category !== 'quote_request') && (taskChainService || this.taskChainService)) {
      const chain = taskChainService || this.taskChainService;
      const categorySteps = decision.category === 'quote_request'
        ? [
          { name: 'email_read', task_type: 'email_read', required: true },
          { name: 'lookup_customer', task_type: 'crm_lookup', required: false },
          { name: 'generate_quote', task_type: 'quote_generate', required: true },
        ]
        : decision.category === 'customer_support'
          ? [{ name: 'email_read', task_type: 'email_read', required: true }, { name: 'draft_support_response', task_type: 'support_response', required: true }]
          : decision.category === 'lead'
            ? [{ name: 'email_read', task_type: 'email_read', required: true }, { name: 'lookup_customer', task_type: 'crm_lookup', required: false }, { name: 'capture_lead', task_type: 'lead_capture', required: true }]
            : [{ name: 'email_read', task_type: 'email_read', required: true }, { name: 'lookup_customer', task_type: 'crm_lookup', required: false }, { name: 'update_crm', task_type: 'crm_update', required: true }];
            
      const requiresResponseEmail = ['quote_request', 'customer_support'].includes(decision.category);
      
      const chainConfig = {
        steps: [
          ...categorySteps,
          ...(requiresResponseEmail ? [
            { name: 'draft_email', task_type: 'email_draft', required: true },
            { name: 'await_approval', task_type: 'approval_gate', required: true },
            { name: 'send_email', task_type: 'email_send', required: true },
          ] : []),
        ],
        on_step_failure: 'abort',
        failure_notification: true,
      };

      const created = await chain.createChain(task.tenant_id, task.client_profile_id, chainConfig, { ...payload, classification: decision });
      return { provider: this.providerName, output: { status: 'completed', content: `${decision.category} chain created.`, chain: created, triage: decision } };
    }

    if (!decision.requires_response && this.gmailProvider?.markRead) {
      await this.gmailProvider.markRead(payload.credential_reference, payload.message_id, task.tenant_id);
      if (memories && employeeId) {
        await memories.create({
          employee_id: employeeId,
          task_id: task.id,
          memory_type: 'email_skipped',
          source: 'email',
          thread_id: payload.thread_id || null,
          content: `Skipped email from ${payload.sender || 'unknown'}: ${payload.subject || ''}`,
          metadata: { category: decision.category || null, message_id: payload.message_id },
        });
      }
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
