export class InMemoryContactRepository {
  constructor({ store = new Map(), clock = () => new Date() } = {}) {
    this.contacts = store;
    this.clock = clock;
  }

  async findById(id, tenantId) {
    const contact = this.contacts.get(id);
    return contact?.tenant_id === tenantId ? { ...contact } : null;
  }

  async list(tenantId) {
    return [...this.contacts.values()].filter(contact => contact.tenant_id === tenantId).map(contact => ({ ...contact }));
  }

  async listAll() {
    return [...this.contacts.values()].map(contact => ({ ...contact }));
  }

  async upsert(input) {
    const existing = [...this.contacts.values()].find(contact => (
      contact.tenant_id === input.tenant_id && contact.email === input.email
    ));
    const now = this.clock().toISOString();
    const contact = {
      id: existing?.id || input.id || `contact-${this.contacts.size + 1}`,
      created_at: existing?.created_at || now,
      updated_at: now,
      ...existing,
      ...input,
    };
    this.contacts.set(contact.id, contact);
    return { ...contact };
  }
}
