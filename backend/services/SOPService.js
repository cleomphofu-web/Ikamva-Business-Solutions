export class SOPService {
  constructor({ sopRepository }) {
    this.sopRepository = sopRepository;
  }

  async loadActiveSOP({ tenantId, taskType }) {
    const sop = await this.sopRepository.findActiveByTaskType({ tenantId, taskType });
    if (!sop) {
      throw new Error(`No active SOP found for task type "${taskType}".`);
    }
    return sop;
  }

  async getLatestVersion({ tenantId, taskType }) {
    return this.sopRepository.findLatestVersion({ tenantId, taskType });
  }

  validateInput(sop, payload) {
    const required = Array.isArray(sop.validation_schema?.required)
      ? sop.validation_schema.required
      : [];

    const missing = required.filter(field => payload?.[field] === undefined || payload?.[field] === null);
    if (missing.length > 0) {
      const error = new Error(`Task payload is missing required fields: ${missing.join(', ')}`);
      error.code = 'validation_failed';
      error.details = { missing };
      throw error;
    }

    return true;
  }

  renderPrompt(sop, normalizedPayload) {
    return [
      sop.system_prompt,
      '',
      'Task payload:',
      JSON.stringify(normalizedPayload, null, 2),
    ].join('\n');
  }
}
