import supabaseAdmin from '../lib/supabase-admin.js';
import { createOAuthState, exchangeCode, encryptRefreshToken, gmailConsentUrl, readOAuthState } from '../services/GmailOAuthService.js';
import { getRootContainer } from './workforce.js';
import { createTenantExecutionContainer } from '../container/createExecutionContainer.js';

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
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  try {
    if (path === '/api/v1/integrations/status' && req.method === 'GET') {
      const tenantId = await tenantFromRequest(req);
      const { data, error } = await supabaseAdmin.from('tenant_integrations').select('id, provider, display_name, account_email, status, scopes, push_expiry, updated_at').eq('tenant_id', tenantId).order('display_name');
      if (error) throw error;
      return json(res, 200, { integrations: data || [] });
    }
    if (path === '/api/v1/integrations/gmail/connect' && req.method === 'GET') {
      const tenantId = await tenantFromRequest(req);
      const returnPath = new URL(req.url, 'http://127.0.0.1').searchParams.get('return_to') || '/dashboard/tools';
      return json(res, 200, { consent_url: gmailConsentUrl(tenantId, returnPath) });
    }
    if (path === '/api/v1/integrations/gmail/callback' && req.method === 'GET') {
      const query = new URL(req.url, 'http://127.0.0.1').searchParams;
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
      const scoped = createTenantExecutionContainer({ tenantId, rootContainer: getRootContainer() });
      const repos = scoped.resolve('repositories');
      const integration = await repos.tenantIntegrations.findByProvider('gmail');
      // Stop the push watch before disconnecting so Gmail stops delivering notifications.
      if (integration?.status === 'connected' && integration.credential_reference) {
        try {
          const watchService = scoped.resolve('gmailWatchService');
          await watchService.stopWatch(integration.credential_reference, tenantId);
        } catch (watchErr) {
          // Non-fatal: we still disconnect even if the watch stop fails.
          console.warn('[Integrations] watch stop failed during disconnect', { tenantId, error: watchErr?.message });
        }
      }
      await repos.tenantIntegrations.disconnect('gmail');
      return json(res, 200, { disconnected: true });
    }

    // ── Gmail push watch management ─────────────────────────────────────────
    if (path === '/api/v1/integrations/gmail/watch' && req.method === 'POST') {
      const tenantId = await tenantFromRequest(req);
      const scoped = createTenantExecutionContainer({ tenantId, rootContainer: getRootContainer() });
      const repos = scoped.resolve('repositories');
      const integration = await repos.tenantIntegrations.findByProvider('gmail');
      if (!integration || integration.status !== 'connected' || !integration.credential_reference) {
        return json(res, 409, { error: 'Gmail is not connected. Connect Gmail before registering a push watch.' });
      }
      const watchService = scoped.resolve('gmailWatchService');
      const result = await watchService.registerWatch(integration.credential_reference, tenantId);
      return json(res, 200, {
        watch_registered: true,
        history_id: result?.historyId,
        expiry: result?.expiration ? new Date(Number(result.expiration)).toISOString() : null,
      });
    }

    if (path === '/api/v1/integrations/gmail/watch' && req.method === 'DELETE') {
      const tenantId = await tenantFromRequest(req);
      const scoped = createTenantExecutionContainer({ tenantId, rootContainer: getRootContainer() });
      const repos = scoped.resolve('repositories');
      const integration = await repos.tenantIntegrations.findByProvider('gmail');
      if (integration?.credential_reference) {
        const watchService = scoped.resolve('gmailWatchService');
        await watchService.stopWatch(integration.credential_reference, tenantId);
      }
      return json(res, 200, { watch_stopped: true });
    }

    return false;
  } catch (error) { return json(res, error.status || 500, { error: error.message || 'Gmail integration failed' }); }
}

