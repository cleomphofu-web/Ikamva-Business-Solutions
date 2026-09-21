import { BaseWorker } from './BaseWorker.js';

export class ShiftStartWorker extends BaseWorker {
  constructor({
    providerName = 'groq',
    specialistRepository = null,
    taskQueueRepository = null,
    approvalRepository = null,
    employeeActivityLogRepository = null,
    auditService = null,
  } = {}) {
    super({ taskType: 'shift_start', providerName });
    this.specialists = specialistRepository;
    this.taskQueue = taskQueueRepository;
    this.approvals = approvalRepository;
    this.activityLogs = employeeActivityLogRepository;
    this.audit = auditService;
  }

  normalizePayload(payload = {}) {
    return {
      ...payload,
      message: payload.message || 'Morning briefing: Review overnight operations, team status, and pending approvals.',
    };
  }

  async execute({
    provider,
    prompt,
    payload,
    sop,
    task,
    specialistRepository,
    taskQueueRepository,
    approvalRepository,
    employeeActivityLogRepository,
    auditService,
    employee,
  }) {
    const tenantId = task.tenant_id;
    const employeeId = employee?.id || task.client_profile_id;
    const specRepo = specialistRepository || this.specialists;
    const queueRepo = taskQueueRepository || this.taskQueue;
    const apprRepo = approvalRepository || this.approvals;
    const actRepo = employeeActivityLogRepository || this.activityLogs;
    const audit = auditService || this.audit;

    // 1. Gather live operational data for briefing
    let specialists = [];
    if (specRepo && employeeId) {
      try {
        specialists = typeof specRepo.listByEmployee === 'function'
          ? (specRepo.listByEmployee.length === 1
              ? await specRepo.listByEmployee(employeeId)
              : await specRepo.listByEmployee(tenantId, employeeId))
          : [];
      } catch (err) {
        console.warn('[ShiftStartWorker] Failed to list specialists:', err?.message);
      }
    }

    let recentTasks = [];
    if (queueRepo) {
      try {
        recentTasks = (await queueRepo.listRecent(tenantId, 25)) || (await queueRepo.listRecent(25)) || [];
      } catch (err) {
        console.warn('[ShiftStartWorker] Failed to list recent tasks:', err?.message);
      }
    }

    let pendingApprovals = [];
    if (apprRepo && tenantId) {
      try {
        const allApprovals = await apprRepo.list(tenantId);
        pendingApprovals = (allApprovals || []).filter(a => a.status === 'pending');
      } catch (err) {
        console.warn('[ShiftStartWorker] Failed to list pending approvals:', err?.message);
      }
    }

    const enabledSpecialists = specialists.filter(s => s.enabled);
    const disabledSpecialists = specialists.filter(s => !s.enabled);
    const completedOvernight = recentTasks.filter(t => t.status === 'completed');
    const failedOvernight = recentTasks.filter(t => t.status === 'failed');

    const structuredBriefing = {
      briefing_type: 'morning_shift_start',
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      employee_id: employeeId,
      team_summary: {
        total_specialists: specialists.length,
        enabled_count: enabledSpecialists.length,
        disabled_count: disabledSpecialists.length,
        enabled: enabledSpecialists.map(s => s.specialist_type),
        disabled: disabledSpecialists.map(s => s.specialist_type),
      },
      activity_summary: {
        recent_tasks_count: recentTasks.length,
        completed_count: completedOvernight.length,
        failed_count: failedOvernight.length,
        needs_attention: failedOvernight.length > 0 || (employee?.lifecycle_status === 'needs_attention'),
      },
      approvals_summary: {
        pending_count: pendingApprovals.length,
        items: pendingApprovals.map(a => ({ id: a.id, task_id: a.task_id, action: a.action })),
      },
    };

    // 2. Execute provider with grounded prompt if provider exists
    let content = '';
    if (provider && typeof provider.execute === 'function') {
      const briefingGroundingPrompt = `${prompt || ''}

LIVE SYSTEM STATE AT SHIFT START:
- Active Specialists (${enabledSpecialists.length}/${specialists.length}): ${enabledSpecialists.map(s => s.display_name).join(', ') || 'None'}
- Disabled Specialists: ${disabledSpecialists.map(s => s.display_name).join(', ') || 'None'}
- Recent Completed Tasks: ${completedOvernight.length}
- Recent Failed Tasks: ${failedOvernight.length}
- Pending Approvals Waiting on Owner: ${pendingApprovals.length}
${employee?.lifecycle_status === 'needs_attention' ? '- FLAG: Employee lifecycle status is currently NEEDS_ATTENTION' : ''}

Generate a concise, professional morning executive briefing for the business owner summarizing team status, overnight activity, and items requiring attention today.`;

      const aiResult = await provider.execute({
        prompt: briefingGroundingPrompt,
        payload: { ...payload, briefing: structuredBriefing },
        sop,
        task,
      });
      content = aiResult?.output?.content || aiResult?.output?.text || aiResult?.content || '';
    }

    if (!content) {
      content = `Morning Briefing: Team is active with ${enabledSpecialists.length} enabled specialist(s). ${completedOvernight.length} task(s) completed, ${pendingApprovals.length} approval(s) waiting on review.`;
    }

    // 3. Persist structured briefing entry to activity logs
    if (actRepo) {
      try {
        await actRepo.append({
          tenant_id: tenantId,
          employee_id: employeeId,
          task_id: task.id,
          action: 'morning_briefing_generated',
          result: 'completed',
          metadata: {
            briefing: structuredBriefing,
            summary_preview: content.slice(0, 200),
          },
        });
      } catch (logErr) {
        console.warn('[ShiftStartWorker] Failed to append activity log:', logErr?.message);
      }
    }

    // 4. Emit audit log
    if (audit) {
      try {
        await audit.emit({
          task,
          eventType: 'SHIFT_BRIEFING_RECORDED',
          message: `Shift briefing recorded. ${pendingApprovals.length} pending approvals, ${enabledSpecialists.length} active specialists.`,
          metadata: structuredBriefing,
          createdBy: 'ShiftStartWorker',
        });
      } catch (auditErr) {
        console.warn('[ShiftStartWorker] Failed to emit audit event:', auditErr?.message);
      }
    }

    return {
      provider: this.providerName,
      output: {
        status: 'completed',
        content,
        briefing: structuredBriefing,
      },
    };
  }
}
