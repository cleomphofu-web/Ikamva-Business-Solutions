export class EmployeeService {
  constructor({ repository }) { this.repository = repository; }
  findByTenant(tenantId) { return this.repository.findByTenant(tenantId); }
  findById(tenantId, id) { return this.repository.findById(tenantId, id); }
  create(tenantId, fields) { return this.repository.create(tenantId, fields); }
  update(tenantId, id, fields) { return this.repository.update(tenantId, id, fields); }
  activate(tenantId, id) { return this.repository.activate(tenantId, id); }
}
