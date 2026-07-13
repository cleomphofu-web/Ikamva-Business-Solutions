export class QuotaExceededError extends Error {
  constructor(message = 'Monthly task quota exceeded') {
    super(message);
    this.name = 'QuotaExceededError';
    this.code = 'quota_exceeded';
  }
}

export class QuotaService {
  constructor({ tenantRepository }) {
    this.tenantRepository = tenantRepository;
  }

  getRemainingQuota(clientProfile) {
    const limit = Number(clientProfile?.monthly_task_limit ?? 0);
    const used = Number(clientProfile?.tasks_used_this_month ?? 0);
    return Math.max(limit - used, 0);
  }

  ensureWithinQuota(clientProfile) {
    const remaining = this.getRemainingQuota(clientProfile);
    if (remaining <= 0) {
      throw new QuotaExceededError();
    }
    return remaining;
  }

  async rejectWhenExceeded(clientProfile, taskQueueRepository, taskId) {
    try {
      return this.ensureWithinQuota(clientProfile);
    } catch (error) {
      if (error instanceof QuotaExceededError && taskQueueRepository && taskId) {
        await taskQueueRepository.updateStatus(taskId, 'quota_exceeded');
      }
      throw error;
    }
  }

  async incrementCompletedTaskCount(clientProfileId) {
    return this.tenantRepository.incrementTasksUsed(clientProfileId);
  }

  async getRemainingQuotaForClient(clientProfile) {
    return this.getRemainingQuota(clientProfile);
  }

  async prepareMonthlyReset() {
    throw new Error('Monthly quota reset scheduling must be implemented by the worker layer.');
  }
}
