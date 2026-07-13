export class InMemoryTaskLogRepository {
  constructor({ clock = () => new Date() } = {}) {
    this.clock = clock;
    this.logs = [];
  }

  async append(input) {
    const log = {
      id: input.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      created_at: this.clock().toISOString(),
      ...input,
    };
    this.logs.push(log);
    return { ...log };
  }

  async listByTaskId(taskId) {
    return this.logs.filter(log => log.task_id === taskId).map(log => ({ ...log }));
  }
}
