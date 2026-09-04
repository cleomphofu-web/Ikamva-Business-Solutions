import supabaseAdmin from '../lib/supabase-admin.js';
import { createOAuthState, exchangeCode, encryptRefreshToken, gmailConsentUrl, readOAuthState } from '../services/GmailOAuthService.js';

const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const tenantFromRequest = async req => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw Object.assign(new Error('Missing Authorization header'), { status: 401 });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
  const { data: membership, error: membershipError } = await supabaseAdmin.from('tenant_users').select('tenant_id').eq('user_id', data.user.id).eq('status', 'active').maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw Object.assign(new Error('No active tenant membership'), { status: 403 });
  return membership.tenant_id;
};
export async function handleGmailIntegration(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    if (path === '/api/v1/integrations/gmail/connect' && req.method === 'GET') {
      const tenantId = await tenantFromRequest(req);
      const returnPath = new URL(req.url, 'http://localhost').searchParams.get('return_to') || '/dashboard/tools';
      return json(res, 200, { consent_url: gmailConsentUrl(tenantId, returnPath) });
    }
    if (path === '/api/v1/integrations/gmail/callback' && req.method === 'GET') {
      const query = new URL(req.url, 'http://localhost').searchParams;
      const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      if (query.get('error')) {
        res.writeHead(302, { Location: `${frontend}/dashboard/tools?gmail_error=cancelled` });
        res.end();
        return true;
      }
      const state = readOAuthState(query.get('state'));
      const tokens = await exchangeCode(query.get('code'));
      const { RepositoryFactory } = await import('../repositories/RepositoryFactory.js');
      const factory = new RepositoryFactory({ provider: 'supabase', supabase: supabaseAdmin });
      await factory.forTenant(state.tenantId).tenantIntegrations.upsert({ provider: 'gmail', display_name: 'Gmail', status: 'connected', credential_reference: encryptRefreshToken(tokens.refresh_token), scopes: ['gmail.readonly', 'gmail.send', 'gmail.compose'] });
      res.writeHead(302, { Location: `${frontend}${state.returnPath || '/dashboard/tools'}?connected=gmail` });
      res.end();
      return true;
    }
    if (path === '/api/v1/integrations/gmail/disconnect' && req.method === 'POST') {
      const tenantId = await tenantFromRequest(req);
      const { RepositoryFactory } = await import('../repositories/RepositoryFactory.js');
      const factory = new RepositoryFactory({ provider: 'supabase', supabase: supabaseAdmin });
      await factory.forTenant(tenantId).tenantIntegrations.disconnect('gmail');
      return json(res, 200, { disconnected: true });
    }
    return false;
  } catch (error) { return json(res, error.status || 500, { error: error.message || 'Gmail integration failed' }); }
}
