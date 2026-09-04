import supabaseAdmin from '../lib/supabase-admin.js';
import { findApplicationForUser } from './application-store.js';

const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const getRequestPath = req => new URL(req.url ?? '/', 'http://localhost').pathname;

const getBearerToken = req => (req.headers['authorization'] ?? '').replace(/^Bearer\s+/i, '').trim();

const isAdminUser = user => {
  const role = user?.app_metadata?.role;
  return role === 'admin' || role === 'platform_admin';
};

export async function handleAccessRequest(req, res) {
  if (getRequestPath(req) !== '/api/v1/access' || (req.method ?? 'GET').toUpperCase() !== 'GET') {
    return false;
  }

  const jwt = getBearerToken(req);
  if (!jwt) {
    return json(res, 401, { error: 'Missing Authorization header' });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !authData?.user) {
    console.warn('[access] Supabase Auth rejected token:', {
      message: authError?.message,
      status: authError?.status,
      name: authError?.name,
    });
    return json(res, 401, { error: 'Invalid or expired token' });
  }

  const user = authData.user;

  const [{ data: tenantMembership }, { data: clientProfile }, applicationLookup] = await Promise.all([
    supabaseAdmin
      .from('tenant_users')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('client_profiles')
      .select('*')
      .eq('client_email', user.email ?? '')
      .maybeSingle(),
    findApplicationForUser({ supabaseAdmin, userId: user.id, email: user.email ?? '' }),
  ]);

  const application = applicationLookup.record;
  const applicationStatus = application?.status || (tenantMembership && clientProfile ? 'approved' : 'missing');

  return json(res, 200, {
    authenticated: true,
    user_id: user.id,
    email: user.email ?? '',
    email_verified: Boolean(user.email_confirmed_at),
    application_status: applicationStatus,
    tenant_membership_exists: Boolean(tenantMembership),
    workspace_provisioned: Boolean(applicationStatus === 'approved' || (tenantMembership && clientProfile)),
    billing_allowed: true,
    is_admin: isAdminUser(user),
    tenant_id: tenantMembership?.tenant_id ?? clientProfile?.tenant_id ?? null,
  });
}
