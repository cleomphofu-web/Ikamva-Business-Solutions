export class InMemoryTenantRepository {
  constructor(clientProfiles = []) {
    this.clientProfiles = clientProfiles instanceof Map
      ? clientProfiles
      : new Map(clientProfiles.map(profile => [profile.id, { ...profile }]));
  }

  async findClientProfileById(id) {
    const profile = this.clientProfiles.get(id);
    return profile ? { ...profile } : null;
  }
  async findByWebhookToken(token) {
    return [...this.clientProfiles.values()].find(profile => profile.webhook_token === token) || null;
  }
  async consumeProviderCall(tenantId, limit = 1000) { this.usage ||= new Map(); const key = `${tenantId}:${new Date().toISOString().slice(0, 16)}`; const count = this.usage.get(key) || 0; if (count >= limit) return false; this.usage.set(key, count + 1); return true; }

  async incrementTasksUsed(clientProfileId) {
    const profile = this.clientProfiles.get(clientProfileId);
    if (!profile) return null;

    const currentUsed = Number(profile.tasks_used_this_cycle ?? profile.tasks_used_this_month ?? 0);
    const updated = {
      ...profile,
      tasks_used_this_month: currentUsed + 1,
      tasks_used_this_cycle: currentUsed + 1,
    };
    this.clientProfiles.set(clientProfileId, updated);
    return { ...updated };
  }
}
