export class CRMContactService {
  constructor({ contactRepository }) { this.contacts = contactRepository; }

  async saveContact(input) {
    const email = String(input.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error('CRM contact requires a valid email address.');
    const name = String(input.name || '').trim();
    if (!name) throw new Error('CRM contact requires a name.');
    return this.contacts.upsert({ name, email, phone: input.phone || null, company: input.company || null, source: input.source || 'manual' });
  }

  listContacts({ allTenants = false } = {}) { return allTenants ? this.contacts.listAll() : this.contacts.list(); }
}
