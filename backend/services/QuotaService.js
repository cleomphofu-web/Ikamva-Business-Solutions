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
    const limit = Number(clientProfile?.pack_size ?? clientProfile?.monthly_task_limit ?? 0);
    const used = Number(clientProfile?.tasks_used_this_cycle ?? clientProfile?.tasks_used_this_month ?? 0);
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

  async checkAndHandleExhaustion({ clientProfileId, employeeRepository, tenantId }) {
    if (!this.tenantRepository || !clientProfileId) return false;
    const profile = await this.tenantRepository.findClientProfileById(clientProfileId);
    if (!profile) return false;
    const remaining = this.getRemainingQuota(profile);
    if (remaining <= 0 && employeeRepository) {
      try {
        const employee = typeof employeeRepository.findByTenant === 'function'
          ? await employeeRepository.findByTenant(tenantId || profile.tenant_id)
          : (typeof employeeRepository.findById === 'function' ? await employeeRepository.findById(clientProfileId) : null);
        if (employee?.id) {
          const tenant = tenantId || employee.tenant_id || profile.tenant_id;
          const patch = {
            lifecycle_status: 'needs_attention',
            lifecycle_metadata: {
              ...(employee.lifecycle_metadata || {}),
              reason: 'quota_exhausted',
              pack_size: Number(profile.pack_size ?? profile.monthly_task_limit ?? 0),
              tasks_used: Number(profile.tasks_used_this_cycle ?? profile.tasks_used_this_month ?? 0),
              exhausted_at: new Date().toISOString(),
            }
          };
          if (employeeRepository.update.length >= 3) {
            await employeeRepository.update(tenant, employee.id, patch);
          } else {
            await employeeRepository.update(employee.id, patch);
          }
        }
      } catch (err) {
        console.warn('[QuotaService] Failed to update employee lifecycle on quota exhaustion:', err?.message);
      }
      return true;
    }
    return false;
  }

  async prepareMonthlyReset() {
    throw new Error('Monthly quota reset scheduling must be implemented by the worker layer.');
  }
}
