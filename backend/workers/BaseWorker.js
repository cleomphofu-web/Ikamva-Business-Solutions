export class BaseWorker {
  constructor({ taskType, providerName = 'mock' }) {
    this.taskType = taskType;
    this.providerName = providerName;
  }

  normalizePayload(payload) {
    return payload;
  }

  async execute({ provider, prompt, payload, sop, task }) {
    return provider.execute({ prompt, payload, sop, task });
  }
}
