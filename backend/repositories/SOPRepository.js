export class SOPRepository {
  constructor(databaseService) {
    this.database = databaseService;
  }

  async findActiveByTaskType() {
    throw new Error('SOPRepository.findActiveByTaskType requires a database provider implementation.');
  }

  async findLatestVersion() {
    throw new Error('SOPRepository.findLatestVersion requires a database provider implementation.');
  }
}
