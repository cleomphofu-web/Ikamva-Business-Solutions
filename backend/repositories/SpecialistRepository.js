export class SpecialistRepository {
  async listByEmployee(tenantId, employeeId) { throw new Error('SpecialistRepository.listByEmployee requires a provider implementation.'); }
  async findByType(tenantId, employeeId, specialistType) { throw new Error('SpecialistRepository.findByType requires a provider implementation.'); }
  async create(tenantId, fields) { throw new Error('SpecialistRepository.create requires a provider implementation.'); }
  async update(tenantId, id, fields) { throw new Error('SpecialistRepository.update requires a provider implementation.'); }
  async seedDefaults(tenantId, employeeId, integrations = []) { throw new Error('SpecialistRepository.seedDefaults requires a provider implementation.'); }
}
