export class InMemoryTenantRepository {
  constructor(clientProfiles = []) {
    this.clientProfiles = new Map(clientProfiles.map(profile => [profile.id, { ...profile }]));
  }

  async findClientProfileById(id) {
    const profile = this.clientProfiles.get(id);
    return profile ? { ...profile } : null;
  }

  async incrementTasksUsed(clientProfileId) {
    const profile = this.clientProfiles.get(clientProfileId);
    if (!profile) return null;

    const updated = {
      ...profile,
      tasks_used_this_month: Number(profile.tasks_used_this_month || 0) + 1,
    };
    this.clientProfiles.set(clientProfileId, updated);
    return { ...updated };
  }
}
