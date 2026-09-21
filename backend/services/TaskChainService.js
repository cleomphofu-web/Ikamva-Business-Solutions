import { TaskChainError } from '../lib/errors.js';
import { TaskStatuses } from '../domain/task-events.js';

export class TaskChainService {
  constructor({
    queueService,
    taskQueueRepository,
    auditService,
    notificationService = null,
    chainStateRepository = null,
    specialistRepository = null,
    employeeRepository = null,
    taskLogRepository = null,
    quotaService = null,
    tenantRepository = null,
  }) {
    this.queueService = queueService;
    this.tasks = taskQueueRepository;
    this.auditService = auditService;
    this.notificationService = notificationService;
    this.chainState = chainStateRepository;
    this.specialists = specialistRepository;
    this.employees = employeeRepository;
    this.taskLogs = taskLogRepository;
    this.quotaService = quotaService;
    this.tenants = tenantRepository;
  }

  mapStepToSpecialist(stepType) {
    const mapping = {
      quote_generate: 'sales',
      support_response: 'support',
      crm_lookup: 'crm',
      crm_update: 'crm',
      lead_capture: 'lead_capture',
      email_read: 'support',
      email_draft: 'support',
      email_send: 'support',
      approval_gate: 'support',
    };
    return mapping[stepType] || 'support';
  }

  async sendHoldingReply(initialPayload, specialistType) {
    const emailId = initialPayload?.emailId || initialPayload?.message_id || initialPayload?.id || null;
    const tenantId = initialPayload?.tenantId || initialPayload?.tenant_id || null;
    const employeeId = initialPayload?.employeeId || initialPayload?.employee_id || null;

    let employeeName = 'The Team';
    if (this.employees && employeeId) {
      try {
        const emp = typeof this.employees.findById === 'function'
          ? await this.employees.findById(employeeId)
          : (typeof this.employees.findByTenant === 'function' ? await this.employees.findByTenant(tenantId) : null);
        if (emp?.name) employeeName = emp.name;
      } catch (err) {
        console.warn('[TaskChainService] employee lookup for holding reply failed:', err?.message);
      }
    }

    if (this.queueService && tenantId) {
      await this.queueService.enqueueTask({
        tenant_id: tenantId,
        task_type: 'email_response',
        payload: {
          emailId,
          response: `Thank you for your message. We've received your inquiry and will review it shortly.\n\nNote: This request relates to a capability that is currently being configured for our business. We appreciate your patience.\n\nBest regards,\n${employeeName}`,
          isHoldingReply: true,
        },
      });
    }

    if (this.taskLogs && typeof this.taskLogs.create === 'function') {
      try {
        await this.taskLogs.create({
          type: 'disabled_specialist_attempt',
          specialist_type: specialistType,
          email_id: emailId,
          tenant_id: tenantId,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('[TaskChainService] disabled_specialist_attempt log failed:', logErr?.message);
      }
    }

    return { status: 'holding_reply_sent', specialistType };
  }

  async createChain(tenantId, employeeId, chainConfig, initialPayload) {
    if (!Array.isArray(chainConfig?.steps) || chainConfig.steps.length === 0) throw new TaskChainError('Chain must contain at least one step', 0);

    // 1. Quota Check for new workflow chain initiation
    if (this.quotaService && this.tenants) {
      const clientProfile = await this.tenants.findClientProfileById(employeeId);
      if (clientProfile) {
        const remaining = this.quotaService.getRemainingQuota(clientProfile);
        if (remaining <= 0) {
          await this.quotaService.checkAndHandleExhaustion({
            clientProfileId: employeeId,
            employeeRepository: this.employees,
            tenantId,
          });
          this.quotaService.ensureWithinQuota(clientProfile);
        }
      }
    }

    const firstStepType = chainConfig.steps[0].task_type;
    const specialistType = this.mapStepToSpecialist(firstStepType);

    let specialist = null;
    if (this.specialists) {
      try {
        specialist = typeof this.specialists.findByType === 'function'
          ? (this.specialists.findByType.length === 2
              ? await this.specialists.findByType(employeeId, specialistType)
              : await this.specialists.findByType(tenantId, employeeId, specialistType))
          : (typeof this.specialists.getByType === 'function'
              ? (this.specialists.getByType.length === 2
                  ? await this.specialists.getByType(employeeId, specialistType)
                  : await this.specialists.getByType(tenantId, employeeId, specialistType))
              : null);
      } catch (err) {
        console.warn('[TaskChainService] specialist lookup failed:', err?.message);
      }
    }

    if (specialist && specialist.enabled === false) {
      return this.sendHoldingReply({ ...initialPayload, tenantId, employeeId }, specialistType);
    }

    const parent = await this.queueService.enqueueTask({
      tenant_id: tenantId,
      task_type: 'task_chain',
      client_profile_id: employeeId,
      specialist_id: specialist?.id || null,
      idempotency_key: initialPayload?.idempotency_key || `chain:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      payload: initialPayload,
      chain_config: chainConfig,
      step_index: -1,
      status: 'pending',
    });
    await this.updateActivity({ parent_task_id: parent.id, current_step_label: 'Reading email...', current_step_index: 0, total_steps: chainConfig.steps.length, status: 'running' });
    const first = await this.queueService.enqueueTask({
      tenant_id: tenantId,
      task_type: chainConfig.steps[0].task_type,
      client_profile_id: employeeId,
      specialist_id: specialist?.id || null,
      idempotency_key: `${parent.id}:0`,
      payload: initialPayload,
      parent_task_id: parent.id,
      step_index: 0,
      step_name: chainConfig.steps[0].name,
    });
    return { parentTaskId: parent.id, firstStepTaskId: first.id };
  }

  async advanceChain(completedTaskId, stepResult) {
    const task = await this.tasks.findById(completedTaskId);
    if (!task?.parent_task_id) return null;
    const parent = await this.tasks.findById(task.parent_task_id);
    if (!parent || parent.status === TaskStatuses.COMPLETED) {
      // Idempotency check: chain is already completed; do not double-complete or double-increment quota
      return parent;
    }
    const steps = parent?.chain_config?.steps || [];
    const nextIndex = Number(task.step_index) + 1;
    if (nextIndex >= steps.length) {
      // Final step: use compare-and-set to atomically claim the "completing" slot.
      // Only the first concurrent caller transitions parent from PENDING → COMPLETING;
      // subsequent calls get null and return early — no quota increment, no double-complete.
      const claimed = typeof this.tasks.compareAndSetStatus === 'function'
        ? await this.tasks.compareAndSetStatus(parent.id, TaskStatuses.PENDING, 'completing')
        : parent; // fallback: non-CAS repos accept the race risk (single-threaded environments only)

      if (!claimed) {
        // Another concurrent advanceChain call already claimed this slot — return current parent state
        return this.tasks.findById(parent.id);
      }

      await this.updateActivity({ parent_task_id: parent.id, current_step_label: 'Completed', current_step_index: steps.length - 1, total_steps: steps.length, status: 'completed' });

      // Billable Unit: Exactly 1 completed workflow chain consumes 1 task unit
      if (this.quotaService && parent.client_profile_id) {
        await this.quotaService.incrementCompletedTaskCount(parent.client_profile_id);
        await this.quotaService.checkAndHandleExhaustion({
          clientProfileId: parent.client_profile_id,
          employeeRepository: this.employees,
          tenantId: parent.tenant_id,
        });
      }

      return this.queueService.completeTask(parent, { output: { status: 'chain_completed', result: stepResult } });
    }
    const next = steps[nextIndex];
    await this.updateActivity({ parent_task_id: parent.id, current_step_label: stepLabel(next.task_type), current_step_index: nextIndex, total_steps: steps.length, status: 'running' });
    const priorContext = task.payload?.chain_context || task.payload?.previous_result?.output?.chain_context || {};
    const nextContext = { ...priorContext, ...(stepResult?.output?.chain_context || {}) };
    return this.queueService.enqueueTask({ tenant_id: task.tenant_id, task_type: next.task_type, client_profile_id: task.client_profile_id, idempotency_key: `${parent.id}:${nextIndex}`, payload: { ...(task.payload || {}), previous_result: stepResult, chain_context: nextContext }, parent_task_id: parent.id, step_index: nextIndex, step_name: next.name });
  }


  async resumeChain(parentTaskId, userInputs = {}) {
    const parent = await this.tasks.findById(parentTaskId);
    if (!parent) return null;
    const children = await this.tasks.listByParentId(parentTaskId);
    const lastStep = children.at(-1);
    const steps = parent?.chain_config?.steps || [];
    const nextIndex = lastStep ? Number(lastStep.step_index) + 1 : 0;
    if (nextIndex >= steps.length) {
      await this.updateActivity({ parent_task_id: parent.id, current_step_label: 'Completed', current_step_index: steps.length - 1, total_steps: steps.length, status: 'completed' });
      return this.queueService.completeTask(parent, { output: { status: 'chain_completed', userInputs } });
    }
    const next = steps[nextIndex];
    await this.updateActivity({ parent_task_id: parent.id, current_step_label: stepLabel(next.task_type), current_step_index: nextIndex, total_steps: steps.length, status: 'running' });
    const priorContext = lastStep?.payload?.chain_context || parent.payload?.chain_context || {};
    const nextContext = { ...priorContext, ...userInputs };
    return this.queueService.enqueueTask({
      tenant_id: parent.tenant_id,
      task_type: next.task_type,
      client_profile_id: parent.client_profile_id,
      idempotency_key: `${parent.id}:${nextIndex}`,
      payload: { ...(parent.payload || {}), user_inputs: userInputs, chain_context: nextContext },
      parent_task_id: parent.id,
      step_index: nextIndex,
      step_name: next.name,
    });
  }

  async failChain(failedTaskId, error) {
    const task = await this.tasks.findById(failedTaskId);
    if (!task?.parent_task_id) return null;
    const parent = await this.tasks.findById(task.parent_task_id);
    await this.auditService.emit({ task: parent, eventType: 'CHAIN_FAILED', fromStatus: parent.status, toStatus: TaskStatuses.FAILED, message: error.message, metadata: { stepIndex: task.step_index, stepName: task.step_name, error: error.message } });
    return this.queueService.failTask(parent, error);
  }

  async getChainStatus(parentTaskId) {
    const parent = await this.tasks.findById(parentTaskId);
    if (!parent) return null;
    const children = await this.tasks.listByParentId(parentTaskId);
    return { parentTask: parent, steps: children, currentStep: children.find(step => ![TaskStatuses.COMPLETED, TaskStatuses.FAILED, TaskStatuses.CANCELLED].includes(step.status)) || children.at(-1) || null, overallStatus: parent.status };
  }
  async listChains() { const parents = await this.tasks.listByType('task_chain'); return Promise.all(parents.map((parent) => this.getChainStatus(parent.id))); }
  async recoverStalledChains({ employeeRepository, olderThanMinutes = 30, now = new Date() } = {}) {
    const chains = await this.listChains(); const cutoff = new Date(now).getTime() - olderThanMinutes * 60_000; const recovered = [];
    for (const chain of chains) {
      if (['completed', 'failed', 'cancelled'].includes(chain.overallStatus)) continue;
      const created = new Date(chain.parentTask?.created_at || 0).getTime();
      if (created >= cutoff || !employeeRepository || !chain.parentTask?.client_profile_id) continue;
      const employee = await employeeRepository.findByTenant(chain.parentTask.tenant_id);
      if (employee?.id) { await employeeRepository.update(employee.id, { lifecycle_status: 'needs_attention' }); recovered.push(chain.parentTask.id); }
    }
    return recovered;
  }
  async updateActivity(state) { try { await this.chainState?.upsert(state); } catch (error) { console.warn('[TaskChainService] live activity update unavailable:', error.message); } }
}


export function stepLabel(key) {
  const map = {
    email_read: 'Reading email',
    crm_lookup: 'Appending CRM context',
    lookup_customer: 'Appending CRM context',
    quote_generate: 'Generating quote',
    generate_quote: 'Generating quote',
    support_response: 'Drafting support response',
    draft_support_response: 'Drafting support response',
    lead_capture: 'Capturing lead',
    capture_lead: 'Capturing lead',
    crm_update: 'Updating CRM records',
    update_crm: 'Updating CRM records',
    email_draft: 'Creating Gmail draft',
    draft_email: 'Creating Gmail draft',
    approval_gate: 'Waiting for approval',
    await_approval: 'Waiting for approval',
    email_send: 'Sending email',
    send_email: 'Sending email',
  };
  return map[key] || (key ? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Processing...');
}


