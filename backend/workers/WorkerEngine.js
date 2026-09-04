import { TaskEvents, TaskStatuses } from '../domain/task-events.js';
import { QuotaExceededError } from '../services/QuotaService.js';
import { buildStoredEmployeePrompt } from '../services/EmployeePromptService.js';
import { canonicalSkillId, planIncludesSkill, requiredSkillForTask } from '../config/skill-plans.js';

export class WorkerEngine {
  constructor({
    queueService,
    sopService,
    quotaService,
    tenantRepository,
    employeeActivityLogRepository,
    employeeRepository,
    employeeMemoryRepository,
    companyKnowledgeRepository,
    embeddingService,
    providerRegistry,
    workerRegistry,
    auditService,
    approvalRepository,
    tenantIntegrations,
    gmailMessageService,
  }) {
    this.queueService = queueService;
    this.sopService = sopService;
    this.quotaService = quotaService;
    this.tenantRepository = tenantRepository;
    this.employeeActivityLogRepository = employeeActivityLogRepository;
    this.employeeRepository = employeeRepository;
    this.employeeMemoryRepository = employeeMemoryRepository;
    this.companyKnowledgeRepository = companyKnowledgeRepository;
    this.embeddingService = embeddingService;
    this.providerRegistry = providerRegistry;
    this.workerRegistry = workerRegistry;
    this.auditService = auditService;
    this.approvalRepository = approvalRepository;
    this.tenantIntegrations = tenantIntegrations;
    this.gmailMessageService = gmailMessageService;
  }

  async processNext({ tenantId, workerId, taskTypes = [] } = {}) {
    const task = await this.queueService.claimNextTask({ tenantId, workerId, taskTypes });
    if (!task) return null;

    return this.processTask(task, { workerId });
  }

  async processTask(task, { workerId = 'worker' } = {}) {
    try {
      await this.auditService.emit({
        task,
        eventType: TaskEvents.VALIDATION_STARTED,
        fromStatus: task.status,
        toStatus: TaskStatuses.VALIDATING,
        message: 'Validation started',
        createdBy: workerId,
      });

      const worker = this.workerRegistry.get(task.task_type);
      const sop = await this.sopService.loadActiveSOP({
        tenantId: task.tenant_id,
        taskType: task.task_type,
      });

      this.sopService.validateInput(sop, task.payload);
      const normalizedPayload = worker.normalizePayload(task.payload);

      await this.auditService.emit({
        task,
        eventType: TaskEvents.VALIDATION_COMPLETED,
        fromStatus: TaskStatuses.VALIDATING,
        toStatus: TaskStatuses.WAITING_QUOTA,
        message: 'Validation completed',
        metadata: { sop_id: sop.id },
        createdBy: workerId,
      });

      const clientProfile = await this.tenantRepository.findClientProfileById(task.client_profile_id);
      this.quotaService.ensureWithinQuota(clientProfile);

      const employeeRecord = this.employeeRepository
        ? await this.employeeRepository.findByTenant(task.tenant_id)
        : null;
      const requiredSkill = requiredSkillForTask(task.task_type, normalizedPayload);
      const planConfigured = Boolean(clientProfile?.plan || clientProfile?.service_plan);
      const plan = clientProfile?.plan || clientProfile?.service_plan || 'starter';
      const planAllowed = planIncludesSkill(plan, requiredSkill);
      const enabledSkills = (employeeRecord?.configuration?.skills || []).map(canonicalSkillId);
      const skillEnabled = requiredSkill === 'chat' || enabledSkills.includes(canonicalSkillId(requiredSkill)) || enabledSkills.includes(canonicalSkillId(task.task_type));
      if ((employeeRecord || planConfigured) && (!planAllowed || !skillEnabled)) {
        const code = !planAllowed ? 'PLAN_LIMIT' : 'SKILL_DISABLED';
        return this.queueService.transitionTask(task, TaskStatuses.QUOTA_EXCEEDED, {
          eventType: TaskEvents.QUOTA_EXCEEDED,
          message: !planAllowed ? 'This skill requires a higher plan' : 'This skill is disabled for the Employee',
          metadata: { code, required_skill: requiredSkill, plan },
          createdBy: workerId,
        });
      }

      await this.auditService.emit({
        task,
        eventType: TaskEvents.QUOTA_APPROVED,
        fromStatus: TaskStatuses.WAITING_QUOTA,
        toStatus: TaskStatuses.PROCESSING,
        message: 'Quota approved',
        metadata: { remaining_quota: this.quotaService.getRemainingQuota(clientProfile) },
        createdBy: workerId,
      });

      const provider = this.providerRegistry.get(worker.providerName || sop.model_provider || 'mock');
      const fallbackPrompt = this.sopService.renderPrompt(sop, normalizedPayload);
      const storedPrompt = employeeRecord?.configuration?.system_prompt || buildEmployeePrompt(employeeRecord, fallbackPrompt);
      const prompt = await this.assembleContextPrompt(storedPrompt, employeeRecord, normalizedPayload);

      await this.auditService.emit({
        task,
        eventType: TaskEvents.AI_REQUESTED,
        toStatus: TaskStatuses.PROCESSING,
        message: 'Provider execution requested',
        metadata: { provider: worker.providerName || sop.model_provider || 'mock', prompt, system_prompt: prompt },
        createdBy: workerId,
      });

      const result = await worker.execute({
        provider,
        prompt,
        payload: normalizedPayload,
        sop,
        task,
        queueService: this.queueService,
        gmailMessageService: this.gmailMessageService,
        memoryRepository: this.employeeMemoryRepository,
        employeeId: employeeRecord?.id ?? null,
      });

      if (result?.output?.status === 'awaiting_approval') {
        await this.auditService.emit({ task, eventType: TaskEvents.AI_COMPLETED, toStatus: TaskStatuses.PROCESSING, message: 'Gmail action prepared for approval.', metadata: { provider: result.provider }, createdBy: workerId });
        const parkedTask = await this.queueService.transitionTask(task, TaskStatuses.AWAITING_HUMAN, { eventType: TaskEvents.AWAITING_HUMAN, message: 'Human approval required before Gmail action.', metadata: { provider: result.provider, action: result.output.action }, createdBy: workerId });
        // Write an approval_queue row so the Approval UI and resume handler can look it up.
        if (this.approvalRepository) {
          await this.approvalRepository.create({
            tenant_id:         task.tenant_id,
            task_id:           task.id,
            employee_id:       employeeRecord?.id ?? null,
            action:            'gmail.send',
            action_payload:    {
              ...(result.output.action ?? {}),
              draft_preview: String(result.output.content || '').slice(0, 1000),
            },
            reasoning_summary: `Gmail send to ${normalizedPayload.to ?? '?'} requested by Employee.`,
          });
        }
        // Approval notifications use the existing provider-neutral email
        // contract. No credentials or raw provider response enter the task.
        const notificationRecipient = clientProfile?.email;
        if (notificationRecipient) {
          const emailProvider = this.providerRegistry.get('http-email');
          await emailProvider.send({
            to: notificationRecipient,
            subject: `Approval required: ${normalizedPayload.subject || 'AI email draft'}`,
            text: [
              `An AI Employee prepared an email draft for ${normalizedPayload.sender || normalizedPayload.to || 'a client'}.`,
              `Subject: ${normalizedPayload.subject || ''}`,
              '',
              'Draft preview:',
              String(result.output.content || '').slice(0, 2000),
              '',
              'Review it in Ikamva: /dashboard/approvals',
            ].join('\n'),
            metadata: { task_id: task.id, tenant_id: task.tenant_id, kind: 'approval_required' },
          });
        }
        return parkedTask;
      }

      await this.auditService.emit({
        task,
        eventType: TaskEvents.AI_COMPLETED,
        toStatus: TaskStatuses.PROCESSING,
        message: 'Provider execution completed',
        metadata: { provider: result?.provider },
        createdBy: workerId,
      });

      await this.auditService.emit({
        task,
        eventType: TaskEvents.RESULT_VALIDATED,
        toStatus: TaskStatuses.PROCESSING,
        message: 'Result validated',
        createdBy: workerId,
      });

      if (task.client_profile_id) {
        await this.quotaService.incrementCompletedTaskCount(task.client_profile_id);
      }

      // QueueService records the completion transition and audit metadata. Keep
      // the provider result on the returned task envelope as well so synchronous
      // API callers can display the real response without requiring a result
      // column on task_queue.
      const completedTask = await this.queueService.completeTask(task, result, { createdBy: workerId });
      const activityRepository = this.employeeActivityLogRepository;
      if (activityRepository) {
        const usage = result?.output?.usage ?? null;
        await activityRepository.append({
          task_id: task.id,
          action: 'chat_interaction',
          token_usage: usage,
          estimated_cost: estimateCost(usage),
          result: {
            provider: result?.provider ?? null,
            model: result?.model ?? null,
            status: result?.output?.status ?? null,
            finish_reason: result?.output?.finish_reason ?? null,
          },
        });
      }
      if (this.employeeMemoryRepository && employeeRecord?.id && task.task_type === 'chat') {
        const content = `Client asked: ${String(normalizedPayload.message || '').slice(0, 240)} Employee answered: ${String(result?.output?.content || '').replace(/\s+/g, ' ').slice(0, 420)}`;
        await this.employeeMemoryRepository.create({ employee_id: employeeRecord.id, task_id: task.id, memory_type: 'interaction', source: 'chat', thread_id: normalizedPayload.thread_id || null, content, metadata: { user_message_preview: String(normalizedPayload.message || '').slice(0, 240), response_preview: String(result?.output?.content || '').slice(0, 420), tokens_used: result?.output?.usage?.total_tokens ?? null, model: result?.model ?? null } });
      }
      return { ...completedTask, result };
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        await this.auditService.emit({
          task,
          eventType: TaskEvents.QUOTA_EXCEEDED,
          toStatus: TaskStatuses.QUOTA_EXCEEDED,
          message: error.message,
          createdBy: workerId,
        });
        return this.queueService.transitionTask(task, TaskStatuses.QUOTA_EXCEEDED, {
          eventType: TaskEvents.QUOTA_EXCEEDED,
          message: error.message,
          createdBy: workerId,
        });
      }

      return this.queueService.failTask(task, error, { createdBy: workerId });
    }
  }

  async assembleContextPrompt(basePrompt, employee, payload) {
    let prompt = basePrompt;
    const schedule = employee?.schedule || {};
    const timezone = schedule.timezone || 'UTC';
    const now = new Date();
    const clock = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
    const days = Array.isArray(schedule.days) && schedule.days.length ? schedule.days.join(', ') : 'All days';
    const start = schedule.start || '00:00'; const end = schedule.end || '23:59';
    prompt += `\n\nSYSTEM TIME CONTEXT:\n- Live Server Time: ${clock}\n- Configured Timezone: ${timezone}\n- Configured Shift: ${start} to ${end} (${days})\n\nINSTRUCTION: Evaluate whether the Live Server Time falls within the Configured Shift hours. Only invoke the out-of-office response if the current live time is strictly outside these boundaries.`;
    if (schedule.start && schedule.end) {
      const localParts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
      const part = type => localParts.find(item => item.type === type)?.value || '';
      const current = Number(part('hour')) * 60 + Number(part('minute'));
      const toMinutes = value => { const [h, m] = String(value).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
      const activeDay = !Array.isArray(schedule.days) || schedule.days.length === 0 || schedule.days.includes(part('weekday'));
      if (!activeDay || current < toMinutes(schedule.start) || current >= toMinutes(schedule.end)) prompt += '\n\nNOTE: You are currently outside your scheduled working hours. Inform the client if they ask.';
    }
    if (this.employeeMemoryRepository && employee?.id) {
      const threadId = payload?.thread_id || null;
      const threadMemories = threadId ? await this.employeeMemoryRepository.listByEmployee(employee.id, { limit: 20, threadId }) : [];
      const generalMemories = await this.employeeMemoryRepository.listByEmployee(employee.id, { limit: 20 });
      const seen = new Set(threadMemories.map(memory => memory.id));
      const memories = [...threadMemories, ...generalMemories.filter(memory => !seen.has(memory.id))].slice(0, 20);
      if (memories.length) prompt += `\n\nRECENT MEMORY:\n${memories.map(memory => memory.content).join('\n')}`;
    }
    if (this.companyKnowledgeRepository && payload?.message) {
      let chunks;
      if (this.embeddingService?.apiKey && typeof this.companyKnowledgeRepository.searchByEmbedding === 'function') {
        chunks = await this.companyKnowledgeRepository.searchByEmbedding(await this.embeddingService.embed(payload.message), 3);
      } else chunks = await this.companyKnowledgeRepository.search(payload.message, 3);
      if (chunks.length) prompt += `\n\nRELEVANT COMPANY KNOWLEDGE:\n${chunks.map(chunk => chunk.content).join('\n')}`;
    }
    return prompt;
  }

  // ── Post-approval resume ─────────────────────────────────────────────────

  /**
   * Called by the approval API handler after a human approves the action.
   * Emits HUMAN_APPROVED → GMAIL_SENT → TASK_COMPLETED.
   *
   * @param {object} task           The awaiting_human task record
   * @param {object} approval       The approval_queue row (must contain action_payload)
   * @param {object} options
   * @param {string} options.reviewedBy          User id of the approver
   * @param {string} options.credentialReference Encrypted refresh token from tenant_integrations
   */
  async resumeApprovedTask(task, approval, { reviewedBy = 'human', credentialReference } = {}) {
    // 1. Record human decision
    await this.auditService.emit({
      task,
      eventType: TaskEvents.HUMAN_APPROVED,
      fromStatus: TaskStatuses.AWAITING_HUMAN,
      toStatus:   TaskStatuses.PROCESSING,
      message:    'Human approved Gmail send action.',
      metadata:   { approval_id: approval.id, reviewed_by: reviewedBy },
      createdBy:  reviewedBy,
    });

    // 2. Execute the real Gmail send via the live provider
    const gmailProvider = this.providerRegistry.get('gmail-mcp');
    if (typeof gmailProvider?.sendWithCredential !== 'function') {
      throw new Error('gmail-mcp provider does not implement sendWithCredential().');
    }
    const sendResult = approval.action_payload?.draft_id && this.gmailMessageService
      ? await this.gmailMessageService.sendDraft(credentialReference, approval.action_payload.draft_id)
      : await gmailProvider.sendWithCredential({
      payload:             approval.action_payload,
      credentialReference,
    });

    // 3. Emit GMAIL_SENT — only safe metadata, never credentials or full body
    await this.auditService.emit({
      task,
      eventType: TaskEvents.GMAIL_SENT,
      toStatus:  TaskStatuses.PROCESSING,
      message:   'Gmail email dispatched via live API.',
      metadata:  {
        message_id: sendResult?.id || sendResult.message_id,
        thread_id:  sendResult?.threadId || sendResult.thread_id,
        recipient:  sendResult.recipient,
        subject:    sendResult.subject,
        preview:    String(approval.action_payload?.text || '').slice(0, 120),
      },
      createdBy: reviewedBy,
    });

    const employee = this.employeeRepository ? await this.employeeRepository.findByTenant(task.tenant_id) : null;
    if (this.employeeMemoryRepository && employee?.id) {
      await this.employeeMemoryRepository.create({
        employee_id: employee.id, task_id: task.id, memory_type: 'email_sent', source: 'email',
        thread_id: approval.action_payload?.thread_id || task.payload?.thread_id || null,
        content: `Approved email sent to ${approval.action_payload?.to || 'recipient'}: ${approval.action_payload?.subject || ''}`,
        metadata: { message_id: sendResult?.id || sendResult?.message_id || null },
      });
    }

    // 4. Mark task COMPLETED
    return this.queueService.completeTask(task, {
      provider: 'gmail-mcp',
      output:   { status: 'sent', message_id: sendResult.message_id },
    }, { createdBy: reviewedBy });
  }

  /**
   * Called by the approval API handler when a human rejects the action.
   * Emits HUMAN_REJECTED → TASK_COMPLETED (with rejected result).
   */
  async rejectTask(task, approval, { reviewedBy = 'human', reviewNote = '', credentialReference } = {}) {
    if (approval.action_payload?.draft_id && this.gmailMessageService) await this.gmailMessageService.deleteDraft(credentialReference, approval.action_payload.draft_id);
    await this.auditService.emit({
      task,
      eventType: TaskEvents.HUMAN_REJECTED,
      fromStatus: TaskStatuses.AWAITING_HUMAN,
      toStatus:   TaskStatuses.COMPLETED,
      message:    reviewNote || 'Human rejected Gmail send action.',
      metadata:   { approval_id: approval.id, reviewed_by: reviewedBy, review_note: reviewNote },
      createdBy:  reviewedBy,
    });

    const employee = this.employeeRepository ? await this.employeeRepository.findByTenant(task.tenant_id) : null;
    if (this.employeeMemoryRepository && employee?.id) {
      await this.employeeMemoryRepository.create({
        employee_id: employee.id, task_id: task.id, memory_type: 'email_rejected', source: 'email',
        thread_id: approval.action_payload?.thread_id || task.payload?.thread_id || null,
        content: `Rejected email draft for ${approval.action_payload?.to || 'recipient'}: ${approval.action_payload?.subject || ''}`,
        metadata: { review_note: reviewNote || null },
      });
    }

    return this.queueService.completeTask(task, {
      provider: 'gmail-mcp',
      output:   { status: 'rejected', reason: reviewNote || 'Human rejected.' },
    }, { createdBy: reviewedBy });
  }
}

function buildEmployeePrompt(employee, fallback) {
  if (!employee || employee.lifecycle_status !== 'active') return fallback;
  const config = employee.configuration || {};
  const list = value => Array.isArray(value) ? value.join('\\n') : String(value || '');
  return [
    `You are ${employee.name}, an AI Employee.`,
    `Role: ${employee.role || ''}`,
    `Mission: ${employee.mission || employee.description || ''}`,
    `Personality: ${employee.personality || ''}`,
    `Company: ${config.company_name || ''} — ${config.description || ''}`,
    `Products/Services: ${config.products || ''}`,
    `Customers: ${config.customers || ''}`,
    'Rules you must follow:',
    list(employee.rules),
    '',
    fallback,
  ].join('\\n');
}

function estimateCost(usage) {
  if (!usage) return null;
  const prompt = Number(usage.prompt_tokens ?? 0);
  const completion = Number(usage.completion_tokens ?? 0);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) return null;
  return ((prompt / 1_000_000) * 0.15) + ((completion / 1_000_000) * 0.60);
}
