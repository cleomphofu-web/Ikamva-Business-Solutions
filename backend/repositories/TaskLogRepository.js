export class TaskLogRepository {
  constructor(databaseService) {
    this.database = databaseService;
  }

  async append() {
    throw new Error('TaskLogRepository.append requires a database provider implementation.');
  }

  async listByTaskId() {
    throw new Error('TaskLogRepository.listByTaskId requires a database provider implementation.');
  }
}
