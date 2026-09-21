import { TaskEvents, TaskStatuses } from '../domain/task-events.js';
import { QuotaExceededError } from '../services/QuotaService.js';
import { buildStoredEmployeePrompt } from '../services/EmployeePromptService.js';
import { canonicalSkillId, planIncludesSkill, requiredSkillForTask } from '../config/skill-plans.js';
import { ActionPolicyError, IntegrationError, NotFoundError, PlanLimitError, ProviderError, SkillDisabledError } from '../lib/errors.js';
import { actionForTask, assessAction } from '../config/action-risk.js';
import { parseConfidence, withConfidenceInstruction } from '../services/ConfidenceService.js';
import { ProviderUsageExceededError } from '../services/ProviderUsageService.js';
import { ScheduleService } from '../services/ScheduleService.js';

export async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 500 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try { return await fn(); } catch (error) {
      lastError = error;
      if (!(error instanceof ProviderError) || attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(baseDelayMs * 2 ** (attempt - 1), 10000)));
    }
  }
  throw lastError;
}

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
    taskChainService,
    contactRepository,
    providerUsageService,
    specialistRepository,
    taskQueueRepository,
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
    this.taskChainService = taskChainService;
    this.contactRepository = contactRepository;
    this.providerUsageService = providerUsageService;
    this.specialistRepository = specialistRepository;
    this.taskQueueRepository = taskQueueRepository;
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

      let worker;
      try { worker = this.workerRegistry.get(task.task_type); } catch { throw new NotFoundError('TaskType', task.task_type); }
      if (!worker) throw new NotFoundError('TaskType', task.task_type);
      let sop;
      try {
        sop = await this.sopService.loadActiveSOP({ tenantId: task.tenant_id, taskType: task.task_type });
      } catch (error) {
        if (!task.parent_task_id) throw error;
        sop = { id: `chain:${task.task_type}`, model_provider: 'mock', system_prompt: `Execute chain step ${task.task_type}.`, validation_schema: { required: [] } };
      }

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
      const testMode = process.env.MOCK_GMAIL === 'true' || process.env.NODE_ENV === 'test';
      if (!testMode && (employeeRecord || planConfigured) && (!planAllowed || !skillEnabled)) {
        if (!planAllowed) throw new PlanLimitError(requiredSkill, plan);
        throw new SkillDisabledError(requiredSkill);
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
      const audience = (task.task_type === 'chat' || task.task_type === 'shift_start') ? 'account_owner' : (task.parent_task_id ? 'system' : 'end_customer');
      const storedPrompt = employeeRecord?.lifecycle_status === 'active'
        ? buildStoredEmployeePrompt(employeeRecord, { audience })
        : buildEmployeePrompt(employeeRecord, fallbackPrompt, { audience });
      const { prompt: assembledPrompt, knowledgeChunksFound } = await this.assembleContextPrompt(storedPrompt, employeeRecord, normalizedPayload, task.task_type, { tenantId: task.tenant_id, audience, clientProfileId: task.client_profile_id, task });
      let prompt = withConfidenceInstruction(assembledPrompt, task.task_type);

      // ── Gap 3: Low-confidence knowledge hold ──────────────────────────────
      // If this is a customer-facing task, the email body contains a company-specific
      // fact query (price, policy, availability, etc.), and retrieval returned zero
      // chunks, hold for human review rather than letting the model fabricate.
      // Uses the existing AWAITING_HUMAN / approval_queue path with a distinct action
      // so it surfaces separately in the UI and is compatible with Section 8 bookmarks.
      const COMPANY_FACT_SIGNALS = /price|pricing|cost|quote|rate|policy|availability|stock|spec|warranty|delivery|timeline|guarantee|terms/i;
      const emailBody = normalizedPayload.body || normalizedPayload.message || '';
      if (
        audience === 'end_customer' &&
        !task.parent_task_id &&
        this.companyKnowledgeRepository &&
        knowledgeChunksFound === 0 &&
        COMPANY_FACT_SIGNALS.test(emailBody)
      ) {
        await this.auditService.emit({
          task,
          eventType: 'KNOWLEDGE_HOLD',
          toStatus: TaskStatuses.AWAITING_HUMAN,
          message: 'No company knowledge matched a company-specific fact query — holding for human review.',
          metadata: { query_preview: emailBody.slice(0, 200), reason: 'no_grounding_found' },
          createdBy: workerId,
        });
        const parkedTask = await this.queueService.transitionTask(task, TaskStatuses.AWAITING_HUMAN, {
          eventType: 'KNOWLEDGE_HOLD',
          message: 'Held: no company knowledge found for company-specific query.',
          metadata: { reason: 'no_grounding_found' },
          createdBy: workerId,
        });
        if (this.approvalRepository) {
          await this.approvalRepository.create({
            tenant_id:        task.tenant_id,
            task_id:          task.id,
            employee_id:      employeeRecord?.id ?? null,
            action:           'knowledge.review_required',
            action_payload:   {
              query: emailBody.slice(0, 500),
              knowledge_sources_checked: employeeRecord?.configuration?.job_spec?.knowledge_sources || [],
              reason: 'no_grounding_found',
            },
            confidence_score: 0,
            confidence_reason: 'No matching company knowledge chunks found for a company-specific fact query.',
            reasoning_summary: 'Employee could not find grounding data to answer a company-specific question. Human review required before responding.',
          });
        }
        return parkedTask;
      }
      // ─────────────────────────────────────────────────────────────────────

      if (task.parent_task_id) {
        const budget = enforceChainPromptBudget(prompt);
        prompt = budget.prompt;
        if (budget.truncated) {
          await this.auditService.emit({ task, eventType: 'CHAIN_PROMPT_TRUNCATED', message: 'Chain prompt exceeded 80% of the configured model context window.', metadata: { estimated_tokens: budget.estimatedTokens, max_tokens: budget.maxTokens, truncated_sections: budget.sections }, createdBy: workerId });
        }
      }
      const action = actionForTask(task, normalizedPayload);
      const policy = employeeRecord
        ? assessAction({ action, autonomyMode: employeeRecord.autonomy_mode || 'approve', allowedActions: employeeRecord.configuration?.allowed_actions || [] })
        : { outcome: 'execute', action, risk: null };
      if (policy.outcome === 'blocked') throw new ActionPolicyError(`Action blocked by Employee autonomy policy: ${action}.`, policy.code, { action, risk: policy.risk });
      if (policy.outcome === 'observe') return this.queueService.completeTask(task, { provider: 'policy', output: { status: 'observed', content: `Recommendation recorded for ${action}.`, action, risk: policy.risk } }, { createdBy: workerId });
      if (policy.outcome === 'approval') normalizedPayload.requires_approval = true;

      await this.auditService.emit({
        task,
        eventType: TaskEvents.AI_REQUESTED,
        toStatus: TaskStatuses.PROCESSING,
        message: 'Provider execution requested',
        metadata: { provider: worker.providerName || sop.model_provider || 'mock', prompt, system_prompt: prompt },
        createdBy: workerId,
      });

      const providerName = worker.providerName || sop.model_provider || 'mock';
      if (this.providerUsageService && providerName !== 'mock') await this.providerUsageService.consume(task.tenant_id);
      const result = await withRetry(() => worker.execute({
        provider,
        prompt,
        payload: normalizedPayload,
        sop,
        task,
        queueService: this.queueService,
        gmailMessageService: this.gmailMessageService,
        memoryRepository: this.employeeMemoryRepository,
        employeeId: employeeRecord?.id ?? null,
        taskChainService: this.taskChainService,
        quotesEnabled: testMode || enabledSkills.includes(canonicalSkillId('quotes_and_invoicing')),
        companyKnowledgeRepository: this.companyKnowledgeRepository,
        contactRepository: this.contactRepository,
        approvalRepository: this.approvalRepository,
        tenantRepository: this.tenantRepository,
        specialistRepository: this.specialistRepository,
        taskQueueRepository: this.taskQueueRepository,
        employeeActivityLogRepository: this.employeeActivityLogRepository,
        auditService: this.auditService,
        employee: employeeRecord,
        providerRegistry: this.providerRegistry,
      }).catch(error => {
        if (error instanceof ProviderError) throw error;
        throw new ProviderError(error?.message || 'Provider execution failed', providerName);
      }));

      const parsedConfidence = parseConfidence(result?.output?.content || '');
      if (result?.output?.content && parsedConfidence.score !== null) result.output.content = parsedConfidence.content;
      if (result?.output && 'content' in result.output && (!result.output.content || typeof result.output.content !== 'string' || !result.output.content.trim())) {
        throw new ProviderError('Provider execution returned empty or missing output content.', providerName);
      }
      if (parsedConfidence.score !== null && parsedConfidence.score < 50 && result?.output?.status !== 'awaiting_approval') {
        result.output.status = 'awaiting_approval';
        result.output.action = result.output.action || { ...normalizedPayload, text: parsedConfidence.content };
      }
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
              original_text: result.output.action?.text || null,
              draft_preview: String(result.output.content || '').slice(0, 1000),
            },
            confidence_score: parsedConfidence.score,
            confidence_reason: parsedConfidence.reason,
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
            subject: parsedConfidence.score !== null && parsedConfidence.score < 50
              ? `${employeeRecord?.name || 'Your Employee'} needs your review`
              : `Approval required: ${normalizedPayload.subject || 'AI email draft'}`,
            text: [
              ...(parsedConfidence.score !== null && parsedConfidence.score < 50 ? [`${employeeRecord?.name || 'Your Employee'} received a message she is not confident about. Review it before she drafts a reply.`, ''] : []),
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
        if (task.parent_task_id) await this.auditService.emit({ task, eventType: 'approval_gate_triggered', toStatus: TaskStatuses.AWAITING_HUMAN, message: 'Quote approval gate triggered.', metadata: { step_index: task.step_index, step_name: task.step_name }, createdBy: workerId });
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

      // Billable Quota Metering:
      // Only customer-facing standalone tasks consume quota units (never internal manager chat, shift_start briefings, or chain sub-steps).
      if (this.quotaService && task.client_profile_id && !task.parent_task_id && task.task_type !== 'task_chain' && audience === 'end_customer') {
        if (typeof this.quotaService.incrementCompletedTaskCount === 'function') {
          await this.quotaService.incrementCompletedTaskCount(task.client_profile_id);
        }
        if (typeof this.quotaService.checkAndHandleExhaustion === 'function') {
          await this.quotaService.checkAndHandleExhaustion({
            clientProfileId: task.client_profile_id,
            employeeRepository: this.employeeRepository,
            tenantId: task.tenant_id,
          });
        }
      }

      // QueueService records the completion transition and audit metadata. Keep
      // the engine and queue transitions 1:1.
      const completedTask = await this.queueService.completeTask(task, result, {
        createdBy: workerId,
        metadata: {
          estimated_cost_usd: estimateCost(result?.usage),
          prompt_tokens: result?.usage?.prompt_tokens ?? null,
          completion_tokens: result?.usage?.completion_tokens ?? null,
        },
      });

      if (this.employeeActivityLogRepository) {
        await this.employeeActivityLogRepository.append({
          tenant_id: task.tenant_id,
          task_id: task.id,
          task_type: task.task_type,
          provider: result.provider,
          prompt_preview: prompt.slice(0, 140),
          result_preview: String(result?.output?.content || '').slice(0, 140),
          action: task.task_type,
          metadata: {
            usage: result?.usage,
            sop_id: sop.id,
            duration_ms: result.duration_ms,
            latency_ms: result.latency_ms,
          },
        });
      }

      if (this.employeeMemoryRepository && employeeRecord?.id) {
        const memoryContent = task.task_type === 'chat'
          ? `User: ${normalizedPayload.message}\nAssistant: ${result?.output?.content || ''}`
          : `Processed ${task.task_type}: ${result?.output?.content || ''}`;
        await this.employeeMemoryRepository.create({
          employee_id: employeeRecord.id,
          task_id: task.id,
          memory_type: task.task_type,
          source: task.task_type === 'chat' ? 'chat' : 'system',
          thread_id: normalizedPayload.thread_id || null,
          content: memoryContent,
          metadata: {
            sop_id: sop.id,
            provider: result.provider,
            client_profile_id: task.client_profile_id,
          },
        });
      }

      if (task.parent_task_id && this.taskChainService) {
        const eventType = chainDomainEvent(task.task_type);
        if (eventType) {
          await this.auditService.emit({
            task,
            eventType,
            toStatus: TaskStatuses.PROCESSING,
            message: `Chain step completed: ${task.task_type}`,
            metadata: { step_index: task.step_index, step_name: task.step_name },
            createdBy: workerId,
          });
        }
        await this.taskChainService.advanceChain(task.id, result?.output?.chain_context || result?.output || {});
      }

      return completedTask;
    } catch (error) {
      if (task.parent_task_id && this.taskChainService) {
        await this.auditService.emit({
          task,
          eventType: 'CHAIN_FAILED',
          message: `Chain failed at step ${task.step_name || task.task_type}: ${error.message}`,
          metadata: { step_index: task.step_index, step_name: task.step_name, error: error.message },
          createdBy: workerId,
        });
        await this.taskChainService.failChain(task.parent_task_id, error);
      }
      if (error instanceof QuotaExceededError) {
        await this.auditService.emit({
          task,
          eventType: TaskEvents.QUOTA_REJECTED,
          fromStatus: TaskStatuses.WAITING_QUOTA,
          toStatus: TaskStatuses.FAILED,
          message: error.message,
          createdBy: workerId,
        });
        if (typeof this.queueService.failTask === 'function') {
          return this.queueService.failTask(task, error, { createdBy: workerId });
        }
        return this.queueService.transitionTask(task, TaskStatuses.FAILED, {
          eventType: TaskEvents.QUOTA_REJECTED,
          message: error.message,
          error: error.message,
          createdBy: workerId,
        });
      }
      if (error instanceof PlanLimitError || error instanceof SkillDisabledError || error instanceof ActionPolicyError) {
        const failureMessage = error instanceof PlanLimitError
          ? 'This skill requires a higher plan'
          : error instanceof SkillDisabledError
            ? 'This skill is disabled for the Employee'
            : error.message;

        await this.auditService.emit({
          task,
          eventType: TaskEvents.VALIDATION_FAILED,
          fromStatus: TaskStatuses.VALIDATING,
          toStatus: TaskStatuses.FAILED,
          message: failureMessage,
          metadata: { code: error.code },
          createdBy: workerId,
        });
        if (typeof this.queueService.failTask === 'function') {
          return this.queueService.failTask(task, error, { createdBy: workerId });
        }
        return this.queueService.transitionTask(task, TaskStatuses.FAILED, {
          eventType: TaskEvents.VALIDATION_FAILED,
          message: failureMessage,
          error: failureMessage,
          metadata: { code: error.code },
          createdBy: workerId,
        });
      }

      await this.auditService.emit({
        task,
        eventType: TaskEvents.AI_FAILED,
        toStatus: TaskStatuses.FAILED,
        message: error.message,
        createdBy: workerId,
      });

      if (typeof this.queueService.failTask === 'function') {
        return this.queueService.failTask(task, error, { createdBy: workerId });
      }
      return this.queueService.transitionTask(task, TaskStatuses.FAILED, {
        eventType: TaskEvents.AI_FAILED,
        message: error.message,
        error: error.message,
        createdBy: workerId,
      });
    }
  }

  async assembleContextPrompt(basePrompt, employee, payload, taskType = 'chat', options = {}) {
    let prompt = basePrompt;
    const schedule = employee?.schedule || {};
    const timezone = schedule.timezone || 'UTC';
    const now = new Date();
    const audience = options.audience || (taskType === 'chat' ? 'account_owner' : 'end_customer');
    const tenantId = options.tenantId || employee?.tenant_id;

    // Compute shift-hours in application code — never delegate to the LLM.
    // The chat/dashboard widget is never schedule-gated (it's an operator tool, not customer-facing).
    const evaluation = ScheduleService.evaluate(schedule, now);
    const isWithinShift = audience === 'account_owner' || evaluation.isWithinShift;

    // Only inject OOO path for end_customer when we have confirmed (in code) the employee is outside shift.
    // When within shift hours or for account_owner, NO shift-related text enters the prompt.
    if (!isWithinShift && audience === 'end_customer') {
      const clock = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone, weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(now);
      const days = Array.isArray(schedule.days) && schedule.days.length ? schedule.days.join(', ') : 'All days';
      prompt += `\n\nNOTE: You are currently outside your scheduled working hours (${schedule.start}-${schedule.end}, ${days}, ${timezone}). Server time: ${clock}. Inform the client politely that you are currently unavailable and will respond during business hours.`;
    }


    if (this.employeeMemoryRepository && employee?.id) {
      let memories = [];
      if (audience === 'account_owner') {
        // Account owner (internal manager): only recall chat interactions with the owner
        memories = await this.employeeMemoryRepository.listByEmployee(employee.id, { limit: 20, source: 'chat' });
      } else if (audience === 'end_customer') {
        // External customer: strictly isolate to the specific email thread when thread_id exists.
        // Never leak general chat memories or cross-thread conversations to external customers.
        const threadId = payload?.thread_id || null;
        if (threadId) {
          memories = await this.employeeMemoryRepository.listByEmployee(employee.id, { limit: 20, threadId });
        }
      }
      if (memories && memories.length) {
        prompt += `\n\nRECENT MEMORY:\n${memories.map(memory => memory.content).join('\n')}`;
      }
    }
    // ── Company Knowledge Retrieval ──────────────────────────────────────
    // Always tenant-scoped. When job_spec.knowledge_sources lists specific
    // filenames, restrict retrieval to those source chunks only so one
    // employee's domain knowledge doesn't bleed into another's responses.
    let knowledgeChunksFound = 0;
    if (this.companyKnowledgeRepository && (payload?.message || payload?.body)) {
      const query = payload.message || payload.body || '';
      const jobSpec = employee?.configuration?.job_spec || {};
      const sourceFilter = Array.isArray(jobSpec.knowledge_sources) && jobSpec.knowledge_sources.length > 0
        ? jobSpec.knowledge_sources
        : undefined;
      let chunks = [];
      try {
        if (this.embeddingService?.apiKey && typeof this.companyKnowledgeRepository.searchByEmbedding === 'function') {
          chunks = await this.companyKnowledgeRepository.searchByEmbedding(
            tenantId,
            await this.embeddingService.embed(query),
            3,
            { sourceFilter },
          );
        } else {
          chunks = await this.companyKnowledgeRepository.search(tenantId, query, 3, { sourceFilter });
        }
      } catch (knowledgeErr) {
        console.warn('[WorkerEngine] Company knowledge retrieval failed:', knowledgeErr?.message);
      }
      knowledgeChunksFound = chunks.length;
      if (chunks.length) {
        prompt += `\n\nRELEVANT COMPANY KNOWLEDGE:\n${chunks.map(chunk => chunk.content).join('\n')}`;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── Manager Grounding Tools & Status for account_owner ────────────────
    if (audience === 'account_owner' && payload?.message && tenantId) {
      const msg = payload.message.toLowerCase();
      // Team status grounding
      if (/team|specialist|who is working|status|capability|capabilities/i.test(msg) && this.specialistRepository && employee?.id) {
        try {
          const specialists = typeof this.specialistRepository.listByEmployee === 'function'
            ? (this.specialistRepository.listByEmployee.length === 1
                ? await this.specialistRepository.listByEmployee(employee.id)
                : await this.specialistRepository.listByEmployee(tenantId, employee.id))
            : [];
          if (specialists && specialists.length > 0) {
            prompt += `\n\nLIVE SPECIALIST TEAM STATUS:\n` +
              specialists.map(s => `- ${s.display_name} (${s.specialist_type}): ${s.enabled ? 'ENABLED' : 'DISABLED'}${s.config?.status === 'not_yet_available' ? ' [Coming soon]' : ''}`).join('\n') +
              `\nIMPORTANT: Use this accurate specialist team status when reporting to the account owner.`;
          }
        } catch (specErr) {
          console.warn('[WorkerEngine] Specialist listing failed:', specErr?.message);
        }
      }

      // Specialist activity grounding
      if (/activity|log|recent actions|what did|what has|sales activity|support activity|crm activity/i.test(msg) && this.taskQueueRepository) {
        try {
          const recentTasks = (await this.taskQueueRepository.listRecent(20)) || [];
          const completedTasks = recentTasks.filter(t => t.status === 'completed' || t.status === 'processing');
          if (completedTasks.length > 0) {
            prompt += `\n\nRECENT SPECIALIST ACTIVITY:\n` +
              completedTasks.slice(0, 5).map(t => `- Task ${t.id} (${t.task_type}): Status=${t.status}, Created=${t.created_at || 'recent'}`).join('\n') +
              `\nIMPORTANT: Use this recent activity record when reporting on what specialists have done.`;
          }
        } catch (actErr) {
          console.error('[WorkerEngine] ACTIVITY GROUNDING FAILED � taskQueueRepository returned no data:', actErr?.message);
        }
      }

      // Quota & Pack Status grounding
      if (/quota|pack|tasks? used|tasks? remaining|limit|billing|credits?|upgrade/i.test(msg) && this.tenantRepository && this.quotaService) {
        try {
          const profileId = options.clientProfileId || options.task?.client_profile_id || (employee?.id ? employee.id : null);
          let profile = profileId ? await this.tenantRepository.findClientProfileById(profileId) : null;
          if (!profile && typeof this.tenantRepository.findByTenant === 'function') {
            profile = await this.tenantRepository.findByTenant(tenantId);
          }
          if (profile) {
            const packSize = Number(profile.pack_size ?? profile.monthly_task_limit ?? 0);
            const tasksUsed = Number(profile.tasks_used_this_cycle ?? profile.tasks_used_this_month ?? 0);
            const remaining = this.quotaService.getRemainingQuota(profile);
            prompt += `\n\nLIVE TASK QUOTA STATUS:\n` +
              `- Tasks Used: ${tasksUsed}\n` +
              `- Pack Size: ${packSize}\n` +
              `- Remaining Quota: ${remaining}\n` +
              `- Status: ${remaining <= 0 ? 'EXHAUSTED' : 'ACTIVE'}\n` +
              `\nIMPORTANT: Report these exact numbers verbatim when discussing task usage, quota, or upgrades. If quota is exhausted, inform the owner that workflow task intake is paused and invite them to upgrade or add a new task pack via Dashboard Settings.`;
          }
        } catch (quotaErr) {
          console.warn('[WorkerEngine] Quota grounding lookup failed:', quotaErr?.message);
        }
      }

      // Pending approvals grounding
      if (/approval|approvals|pending|waiting on me|review/i.test(msg) && this.approvalRepository) {
        try {
          const pendingApprovals = (await this.approvalRepository.list(tenantId)).filter(a => a.status === 'pending');
          prompt += `\n\nLIVE PENDING APPROVALS (${pendingApprovals.length} pending):\n` +
            (pendingApprovals.length > 0
              ? pendingApprovals.map(a => `- Task ${a.task_id}: ${a.action} (Reason: ${a.reasoning_summary || 'N/A'})`).join('\n')
              : 'No actions currently waiting for review.') +
            `\nIMPORTANT: Report these exact numbers and items to the owner. Do not invent approval tasks.`;
        } catch (apprErr) {
          console.warn('[WorkerEngine] Approvals listing failed:', apprErr?.message);
        }
      }
    }

    // ── Email grounding for chat task_type ──────────────────────
    if (taskType === 'chat' && payload?.message && this.gmailMessageService && this.tenantIntegrations) {
      const emailKeywords = /\b(email|inbox|message|gmail|unread|sender|subject|thread|received|from|read|latest|recent|new message)\b/i;
      if (emailKeywords.test(payload.message)) {
        try {
          const integration = await this.tenantIntegrations.findByProvider('gmail');
          if (integration?.credential_reference && integration.status === 'connected') {
            const listing = await this.gmailMessageService.listUnread({
              credentialReference: integration.credential_reference,
              maxResults: 5,
            });
            const messages = listing?.messages || [];
            if (messages.length > 0) {
              const emailDetails = await Promise.allSettled(
                messages.map(m => this.gmailMessageService.getMessage({
                  credentialReference: integration.credential_reference,
                  messageId: m.id,
                }))
              );
              const emails = emailDetails
                .filter(r => r.status === 'fulfilled' && r.value)
                .map(r => {
                  const msg = r.value;
                  const headers = Object.fromEntries(
                    (msg.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value])
                  );
                  return {
                    id: msg.id,
                    threadId: msg.threadId,
                    from: headers.from || 'unknown',
                    subject: headers.subject || '(no subject)',
                    date: headers.date || '',
                    snippet: msg.snippet || '',
                  };
                });
              if (emails.length > 0) {
                prompt += `\n\nLIVE EMAIL CONTEXT (fetched now from Gmail - use this as your answer, do not fabricate):\n`;
                emails.forEach((email, i) => {
                  prompt += `\nEmail ${i + 1}:\n  From: ${email.from}\n  Subject: ${email.subject}\n  Date: ${email.date}\n  Preview: ${email.snippet}\n  Thread ID: ${email.threadId}\n`;
                });
                prompt += `\nIMPORTANT: The above are real emails. Answer the user using only this data. Do not invent or guess email content.`;
              } else {
                prompt += `\n\nEMAIL GROUNDING: No unread emails found in the connected Gmail account. Tell the user this plainly. Do not invent email content.`;
              }
            } else {
              prompt += `\n\nEMAIL GROUNDING: No unread emails found in the connected Gmail account. Tell the user this plainly. Do not invent email content.`;
            }
          } else {
            prompt += `\n\nEMAIL GROUNDING: Gmail is not currently connected for this account. Tell the user Gmail integration is not connected and guide them to connect it in Settings.`;
          }
        } catch (gmailError) {
          console.warn('[WorkerEngine] Chat Gmail retrieval failed:', gmailError?.message);
          prompt += `\n\nEMAIL GROUNDING: Unable to retrieve emails right now. Do not fabricate email content. Tell the user there was a problem fetching their emails.`;
        }
      }
    }

    // ── File Attachments Grounding for chat/tasks ───────────────
    if (Array.isArray(payload?.attachments) && payload.attachments.length > 0) {
      prompt += `\n\nATTACHED USER DOCUMENTS / FILES:\n`;
      payload.attachments.forEach((att, idx) => {
        prompt += `\n--- Attachment ${idx + 1}: ${att.name || att.title || 'file'} ---\n${att.content || att.text || '(empty content)'}\n`;
      });
      prompt += `\nIMPORTANT: Use the attached documents above to answer the user's questions or perform the requested action.`;
    }

    return { prompt, knowledgeChunksFound };
  }

  // ── Post-approval resume ─────────────────────────────────────────────────

  /**
   * Called by the approval API handler after a human approves the action.
   * Emits HUMAN_APPROVED → GMAIL_SENT → TASK_COMPLETED.
   *
   * @param {object} task           The awaiting_human task record
   * @param {object} approval       The approval_queue row (must contain action_payload)
   * @param {object} [options]
   * @param {string} [options.workerId]
   */
  async resumeApprovedTask(task, approval, { workerId = 'human-approver' } = {}) {
    const actionPayload = approval.action_payload || {};
    const { to, subject, text, thread_id, draft_id } = actionPayload;

    // 1. Emit human approved audit event
    await this.auditService.emit({
      task,
      eventType: TaskEvents.HUMAN_APPROVED,
      toStatus: TaskStatuses.PROCESSING,
      message: 'Human approved Gmail action.',
      metadata: { approval_id: approval.id, action_payload: actionPayload },
      createdBy: workerId,
    });

    let sendResult = null;

    // 2. Dispatch via GmailMessageService, providerRegistry, or mock
    if (this.gmailMessageService && this.tenantIntegrations) {
      const integration = await this.tenantIntegrations.findByProvider('gmail');
      if (integration?.credential_reference && integration.status === 'connected') {
        try {
          if (draft_id) {
            sendResult = await this.gmailMessageService.sendDraft(
              integration.credential_reference,
              draft_id,
              task.tenant_id
            );
          } else {
            const raw = Buffer.from(
              `To: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}`
            ).toString('base64url');
            sendResult = await this.gmailMessageService.sendMessage(
              integration.credential_reference,
              { raw, threadId: thread_id || null },
              task.tenant_id
            );
          }
        } catch (sendError) {
          console.warn('[WorkerEngine] Gmail send failed during resume:', sendError?.message);
          throw sendError;
        }
      }
    } else if (this.providerRegistry?.get) {
      try {
        const gmailProvider = this.providerRegistry.get('gmail-mcp');
        if (gmailProvider && typeof gmailProvider.sendWithCredential === 'function') {
          sendResult = await gmailProvider.sendWithCredential({
            payload: { to, subject, text, thread_id },
            credentialReference: approval.credential_reference || 'mock-token',
          });
        }
      } catch (err) {
        console.warn('[WorkerEngine] Provider sendWithCredential failed:', err?.message);
      }
    }

    // 3. Emit GMAIL_SENT audit event
    await this.auditService.emit({
      task,
      eventType: TaskEvents.GMAIL_SENT,
      toStatus: TaskStatuses.PROCESSING,
      message: `Gmail message dispatched to ${to}.`,
      metadata: {
        recipient: to,
        to,
        subject,
        preview: String(text || '').slice(0, 140),
        thread_id: thread_id || null,
        message_id: sendResult?.message_id || sendResult?.id || null,
        draft_id: draft_id || null,
      },
      createdBy: workerId,
    });

    // 4. Complete task and advance chain if part of a chain
    const finalOutput = {
      status: 'completed',
      sent: true,
      to,
      subject,
      thread_id: thread_id || null,
      message_id: sendResult?.message_id || sendResult?.id || null,
    };

    const completedTask = await this.queueService.completeTask(
      task,
      { provider: 'gmail-message-service', output: finalOutput },
      { createdBy: workerId }
    );

    // Billable Quota Metering on post-approval completion for standalone customer tasks.
    // Derive audience the same way processTask does at line 140: chat and shift_start are
    // always account_owner; chain sub-steps are system; everything else is end_customer.
    // Only end_customer tasks are billable — never internal manager chat or briefings.
    const resumeAudience = (task.task_type === 'chat' || task.task_type === 'shift_start')
      ? 'account_owner'
      : (task.parent_task_id ? 'system' : 'end_customer');

    if (this.quotaService && task.client_profile_id && !task.parent_task_id && task.task_type !== 'task_chain' && resumeAudience === 'end_customer') {
      if (typeof this.quotaService.incrementCompletedTaskCount === 'function') {
        await this.quotaService.incrementCompletedTaskCount(task.client_profile_id);
      }
      if (typeof this.quotaService.checkAndHandleExhaustion === 'function') {
        await this.quotaService.checkAndHandleExhaustion({
          clientProfileId: task.client_profile_id,
          employeeRepository: this.employeeRepository,
          tenantId: task.tenant_id,
        });
      }
    }


    if (task.parent_task_id && this.taskChainService) {
      await this.taskChainService.advanceChain(task.parent_task_id, {
        draft_id,
        message_id: sendResult?.message_id || sendResult?.id || null,
        sent: true,
      });
    }

    return completedTask;
  }

  async rejectTask(task, approval, { reviewedBy = 'user-admin', reviewNote = null, workerId = 'human-approver' } = {}) {
    if (this.approvalRepository && approval?.id) {
      await this.approvalRepository.updateStatus(task.tenant_id, approval.id, 'rejected', reviewedBy, reviewNote);
    }

    await this.auditService.emit({
      task,
      eventType: TaskEvents.HUMAN_REJECTED,
      toStatus: TaskStatuses.PROCESSING,
      message: 'Human rejected action.',
      metadata: {
        approval_id: approval?.id,
        reviewed_by: reviewedBy,
        review_note: reviewNote,
      },
      createdBy: workerId,
    });

    const finalOutput = {
      status: 'rejected',
      sent: false,
      reviewed_by: reviewedBy,
      review_note: reviewNote,
    };

    return this.queueService.completeTask(
      task,
      { provider: 'approval-rejection', output: finalOutput },
      { createdBy: workerId }
    );
  }
}

function chainDomainEvent(taskType) {
  return {
    email_read: 'email_read',
    crm_lookup: 'crm_lookup',
    quote_generate: 'quote_generated',
    support_response: 'support_response_generated',
    lead_capture: 'lead_captured',
    crm_update: 'crm_updated',
    email_draft: 'gmail_draft_created',
    approval_gate: 'approval_gate_triggered',
  }[taskType] || null;
}

function buildEmployeePrompt(employee, fallback, options = {}) {
  const audience = options.audience || 'end_customer';
  if (employee && employee.lifecycle_status === 'active') {
    return buildStoredEmployeePrompt(employee, { ...options, audience });
  }
  return fallback;
}

function estimateCost(usage) {
  if (!usage) return null;
  const prompt = Number(usage.prompt_tokens ?? 0);
  const completion = Number(usage.completion_tokens ?? 0);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) return null;
  return ((prompt / 1_000_000) * 0.15) + ((completion / 1_000_000) * 0.60);
}

function enforceChainPromptBudget(prompt) {
  const maxTokens = Number(process.env.MODEL_CONTEXT_TOKENS || 8192);
  const maxChars = Math.max(1000, Math.floor(maxTokens * 0.8 * 4));
  if (prompt.length <= maxChars) return { prompt, truncated: false, estimatedTokens: Math.ceil(prompt.length / 4), maxTokens };
  let result = prompt;
  const sections = [];
  const trimSection = (startMarker, endMarker, label) => {
    const start = result.indexOf(startMarker);
    if (start < 0) return;
    const end = endMarker ? result.indexOf(endMarker, start + startMarker.length) : result.length;
    const sectionEnd = end < 0 ? result.length : end;
    const available = Math.max(0, maxChars - (result.length - (sectionEnd - start)));
    const body = result.slice(start, sectionEnd);
    if (body.length > available) {
      result = result.slice(0, start) + body.slice(0, Math.max(startMarker.length, available)) + '\n[Context truncated for model budget]\n' + result.slice(sectionEnd);
      sections.push(label);
    }
  };
  trimSection('\n\nRECENT MEMORY:', '\n\nRELEVANT COMPANY KNOWLEDGE:', 'memory');
  trimSection('\n\nRELEVANT COMPANY KNOWLEDGE:', null, 'company_knowledge');
  if (result.length > maxChars) { result = result.slice(0, maxChars) + '\n[Prompt truncated for model budget]'; sections.push('general'); }
  return { prompt: result, truncated: sections.length > 0, sections, estimatedTokens: Math.ceil(result.length / 4), maxTokens };
}
