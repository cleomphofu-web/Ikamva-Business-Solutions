const TYPES = new Set(['call', 'email', 'meeting', 'note', 'follow_up']);
export class CRMContactNoteService {
  constructor({ noteRepository }) { this.notes = noteRepository; }
  list(contactId, tenantId) { return this.notes.listByContact(contactId, tenantId); }
  create(input) {
    const content = String(input.content || '').trim();
    if (!content) throw new Error('Interaction note requires content.');
    const type = input.type || 'note';
    if (!TYPES.has(type)) throw new Error('Unsupported interaction type.');
    return this.notes.create({ tenant_id: input.tenant_id, contact_id: input.contact_id, author_user_id: input.author_user_id || null, type, content, next_action: input.next_action || null, next_action_date: input.next_action_date || null });
  }
  remove(id, tenantId) { return this.notes.delete(id, tenantId); }
}
