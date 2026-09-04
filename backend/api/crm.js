import supabaseAdmin from '../lib/supabase-admin.js';
import { createExecutionContainer, createTenantExecutionContainer } from '../container/createExecutionContainer.js';
import { CRMContactService } from '../services/CRMContactService.js';
import { CRMContactNoteService } from '../services/CRMContactNoteService.js';
import { CRMLeadService } from '../services/CRMLeadService.js';

const json = (res, status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)); };
const body = req => new Promise((resolve, reject) => { let data = ''; req.on('data', chunk => { data += chunk; }); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (error) { reject(error); } }); req.on('error', reject); });

export async function handleCRMRequest(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(res, 401, { error: 'Missing Authorization header' });
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth?.user) return json(res, 401, { error: 'Invalid or expired token' });

  const isAdmin = ['admin', 'platform_admin'].includes(auth.user.app_metadata?.role);
  const { data: membership, error } = await supabaseAdmin.from('tenant_users').select('tenant_id').eq('user_id', auth.user.id).eq('status', 'active').maybeSingle();
  if (error) return json(res, 500, { error: 'Failed to resolve tenant membership' });
  if (!membership && !isAdmin) return json(res, 403, { error: 'Active tenant membership required' });

  const root = createExecutionContainer({ supabaseAdmin });
  const repositories = membership
    ? createTenantExecutionContainer({ tenantId: membership.tenant_id, rootContainer: root }).resolve('repositories')
    : root.resolve('repositoryFactory').forSystem();
  const service = new CRMContactService({ contactRepository: repositories.contacts });
  if (new URL(req.url, 'http://localhost').pathname === '/api/v1/crm/accounts/summary') {
    const tenantId = membership?.tenant_id;
    if (!tenantId && !isAdmin) return json(res, 403, { error: 'Tenant membership required' });
    const invoiceQuery = supabaseAdmin.from('crm_invoices').select('*');
    const projectQuery = supabaseAdmin.from('crm_projects').select('*');
    const [invoices, projects] = await Promise.all(tenantId ? [invoiceQuery.eq('tenant_id', tenantId), projectQuery.eq('tenant_id', tenantId)] : [invoiceQuery, projectQuery]);
    if (invoices.error || projects.error) return json(res, 500, { error: 'Failed to load account operations' });
    return json(res, 200, { invoices: invoices.data || [], projects: projects.data || [] });
  }
  const projectPath = new URL(req.url, 'http://localhost').pathname;
  if (projectPath === '/api/v1/crm/projects' || projectPath.startsWith('/api/v1/crm/projects/')) {
    if (!membership && !isAdmin) return json(res, 403, { error: 'Tenant membership required' });
    const projectRepository = repositories.projects;
    if (req.method === 'GET') return json(res, 200, { projects: membership ? await projectRepository.list() : await root.resolve('repositoryFactory').forSystem().projects.listAll() });
    if (!membership) return json(res, 403, { error: 'Tenant membership required to modify projects' });
    const id = projectPath.split('/').pop();
    if (req.method === 'DELETE') return json(res, 200, { project: await projectRepository.delete(id) });
    const payload = await body(req);
    return json(res, 200, { project: req.method === 'PATCH' ? await projectRepository.update(id, payload) : await projectRepository.create(payload) });
  }
  const leadPath = new URL(req.url, 'http://localhost').pathname;
  if (leadPath === '/api/v1/crm/leads' || leadPath.startsWith('/api/v1/crm/leads/')) {
    const leads = new CRMLeadService({ leadRepository: repositories.leads });
    if (req.method === 'GET') return json(res, 200, { leads: await leads.list({ allTenants: isAdmin && !membership }) });
    if (!membership) return json(res, 403, { error: 'Tenant membership required to modify leads' });
    if (req.method === 'DELETE') return json(res, 200, { lead: await leads.remove(decodeURIComponent(leadPath.split('/').pop())) });
    try { return json(res, 200, { lead: await leads.save({ ...(await body(req)), tenant_id: membership.tenant_id }) }); } catch (error) { return json(res, 400, { error: error.message }); }
  }
  const noteMatch = new URL(req.url, 'http://localhost').pathname.match(/^\/api\/v1\/crm\/contacts\/([^/]+)\/notes(?:\/([^/]+))?$/);
  if (noteMatch) {
    const contactId = decodeURIComponent(noteMatch[1]);
    const systemContacts = root.resolve('repositoryFactory').forSystem().contacts;
    const contact = membership
      ? await systemContacts.findById(contactId, membership.tenant_id)
      : (await systemContacts.listAll()).find(item => item.id === contactId);
    if (!contact || (!membership && !isAdmin)) return json(res, 404, { error: 'Contact not found' });
    const noteTenantId = contact.tenant_id;
    const noteRepos = membership && membership.tenant_id === noteTenantId ? repositories : root.resolve('repositoryFactory').forSystem();
    const notes = new CRMContactNoteService({ noteRepository: noteRepos.contactNotes });
    if (req.method === 'GET') return json(res, 200, { notes: await notes.list(contactId, noteTenantId) });
    if (req.method === 'DELETE') {
      if (!noteMatch[2]) return json(res, 400, { error: 'Note id required' });
      return json(res, 200, { note: await notes.remove(decodeURIComponent(noteMatch[2]), noteTenantId) });
    }
    try { return json(res, 201, { note: await notes.create({ ...(await body(req)), contact_id: contactId, tenant_id: noteTenantId, author_user_id: auth.user.id }) }); } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (req.method === 'GET') return json(res, 200, { contacts: await service.listContacts({ allTenants: isAdmin && !membership }) });
  if (!membership) return json(res, 403, { error: 'Tenant membership required to create contacts' });
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try { return json(res, 201, { contact: await service.saveContact(await body(req)) }); }
  catch (error) { return json(res, 400, { error: error.message }); }
}
