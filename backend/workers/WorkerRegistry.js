export class WorkerRegistry {
  constructor(workers = {}) {
    this.workers = new Map(Object.entries(workers));
  }

  register(taskType, worker) {
    if (!taskType || !worker) {
      throw new Error('WorkerRegistry.register requires a task type and worker.');
    }

    this.workers.set(taskType, worker);
    return this;
  }

  get(taskType) {
    const worker = this.workers.get(taskType);
    if (!worker) {
      throw new Error(`Worker for task type "${taskType}" is not registered.`);
    }

    return worker;
  }
}
