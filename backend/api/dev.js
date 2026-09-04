import supabaseAdmin from '../lib/supabase-admin.js';
import { getRootContainer } from './workforce.js';
import { createTenantExecutionContainer } from '../container/createExecutionContainer.js';

const DEFAULT_EMAIL = {
  sender: 'james.mokoena@example.com',
  subject: 'Quote request — 50 units premium package',
  body: 'Good day, I would like to request a quote for 50 units of your premium package for delivery to Johannesburg next month. Please include VAT and delivery costs. Kind regards, James',
  thread_id: 'test_quote_thread_001',
};

export async function handleDevRequest(req, res) {
  if (process.env.NODE_ENV !== 'development') return json(res, 404, { error: 'Not found' });
  if (req.method !== 'POST' || req.url.split('?')[0] !== '/api/v1/dev/trigger-email-triage') return false;
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(res, 401, { error: 'Missing Authorization header' });
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return json(res, 401, { error: 'Invalid or expired token' });
    const { data: membership } = await supabaseAdmin.from('tenant_users').select('tenant_id').eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!membership) return json(res, 403, { error: 'No active tenant membership' });
    const body = await readBody(req);
    const email = { ...DEFAULT_EMAIL, ...(body || {}) };
    const scoped = createTenantExecutionContainer({ tenantId: membership.tenant_id, rootContainer: getRootContainer() });
    const integration = await scoped.resolve('repositories').tenantIntegrations.findByProvider('gmail');
    if (!integration?.credential_reference) return json(res, 409, { error: 'Connect Gmail before running the triage test.' });
    const task = await scoped.resolve('queueService').enqueueTask({
      tenant_id: membership.tenant_id,
      task_type: 'email_triage',
      idempotency_key: `dev_email_triage:${membership.tenant_id}:${email.thread_id}`,
      payload: {
        credential_reference: integration.credential_reference,
        message_id: `dev_${email.thread_id}`,
        sender: email.sender,
        subject: email.subject,
        body: email.body,
        thread_id: email.thread_id,
        message: email.body,
      },
    });
    return json(res, 202, { task_id: task.id });
  } catch (error) { return json(res, error.status || 500, { error: error.message || 'Unable to enqueue triage test' }); }
}

function readBody(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', chunk => { data += chunk; }); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (error) { reject(error); } }); req.on('error', reject); }); }
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); return true; }
