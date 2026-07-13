export class TaskLogRepository {
  constructor(databaseService) {
    this.database = databaseService;
  }

  async append() {
    throw new Error('TaskLogRepository.append requires a database provider implementation.');
  }
}
