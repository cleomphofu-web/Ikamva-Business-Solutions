const statuses = new Set(['new','contacted','qualified','proposal','converted','lost']);
export class CRMLeadService {
  constructor({ leadRepository }) { this.leads = leadRepository; }
  list({ allTenants = false } = {}) { return allTenants ? this.leads.listAll() : this.leads.list(); }
  save(input) { const name = String(input.name || '').trim(); const email = String(input.email || '').trim().toLowerCase(); if (!name || !email.includes('@')) throw new Error('Lead requires a name and valid email.'); const status = input.status || 'new'; if (!statuses.has(status)) throw new Error('Unsupported lead status.'); return this.leads.upsert({ ...input, name, email, status, score: Math.max(0, Math.min(100, Number(input.score ?? 50))) }); }
  remove(id) { return this.leads.delete(id); }
}
