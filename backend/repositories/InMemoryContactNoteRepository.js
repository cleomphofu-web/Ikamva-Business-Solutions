export class InMemoryContactNoteRepository {
  constructor({ store = new Map(), clock = () => new Date() } = {}) { this.notes = store; this.clock = clock; }
  async listByContact(contactId, tenantId) { return [...this.notes.values()].filter(n => n.contact_id === contactId && n.tenant_id === tenantId).sort((a,b) => b.created_at.localeCompare(a.created_at)).map(n => ({ ...n })); }
  async create(input) { const now = this.clock().toISOString(); const note = { id: input.id || `note-${this.notes.size + 1}`, created_at: now, updated_at: now, ...input }; this.notes.set(note.id, note); return { ...note }; }
  async delete(id, tenantId) { const note = this.notes.get(id); if (!note || note.tenant_id !== tenantId) return null; this.notes.delete(id); return { ...note }; }
}
