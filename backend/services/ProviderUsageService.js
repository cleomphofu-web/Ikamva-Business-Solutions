export class ProviderUsageExceededError extends Error { constructor() { super('Tenant provider usage limit exceeded'); this.code = 'provider_usage_exceeded'; } }
export class ProviderUsageService {
  constructor({ repository, limit = Number(process.env.TENANT_PROVIDER_CALL_LIMIT || 1000) } = {}) { this.repository = repository; this.limit = limit; }
  async consume(tenantId) {
    const allowed = await this.repository.consumeProviderCall(tenantId, this.limit);
    if (!allowed) throw new ProviderUsageExceededError();
    return true;
  }
}
