export class TenantRepository {
  constructor(databaseService) {
    this.database = databaseService;
  }

  async findTenantForUpdate() {
    throw new Error('TenantRepository.findTenantForUpdate requires a database provider implementation.');
  }

  async incrementTasksUsed() {
    throw new Error('TenantRepository.incrementTasksUsed requires a database provider implementation.');
  }
}
