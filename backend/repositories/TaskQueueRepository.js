export class TaskQueueRepository {
  constructor(databaseService) {
    this.database = databaseService;
  }

  async findById() {
    throw new Error('TaskQueueRepository.findById requires a database provider implementation.');
  }

  async findByIdempotencyKey() {
    throw new Error('TaskQueueRepository.findByIdempotencyKey requires a database provider implementation.');
  }

  async claimNext() {
    throw new Error('TaskQueueRepository.claimNext requires a database provider implementation.');
  }

  async create() {
    throw new Error('TaskQueueRepository.create requires a database provider implementation.');
  }

  async updateStatus() {
    throw new Error('TaskQueueRepository.updateStatus requires a database provider implementation.');
  }

  async scheduleRetry() {
    throw new Error('TaskQueueRepository.scheduleRetry requires a database provider implementation.');
  }
}
