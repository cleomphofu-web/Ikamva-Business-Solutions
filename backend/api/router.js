/**
 * router.js
 *
 * Aggregates all API routes under /api/v1.
 * Used by vite.config.js configureServer hook in development.
 */
import { handleActivityLogs, handleApprovals, handleChatHistory, handleChatStatus, handleEmployeeRequest, handleIntegrations, handleKnowledgeIngest, handleKnowledgeList, handleTaskSubmit } from './workforce.js';
import { handleAccessRequest } from './access.js';
import { handleApplicationsRequest } from './applications.js';
import { handleCRMRequest } from './crm.js';
import { handleGmailIntegration } from './integrations.js';
import { handleDevRequest } from './dev.js';

export function createApiRouter() {
  /**
   * Handle an incoming Node HTTP request.
   * Returns true if the request was handled, false to pass through.
   */
  return async function apiRouter(req, res) {
    const url = req.url?.split('?')[0] ?? '';
    const method = req.method?.toUpperCase() ?? 'GET';

    if (url.startsWith('/api/v1/dev/')) { const handled = await handleDevRequest(req, res); if (handled !== false) return true; }

    if (url.startsWith('/api/v1/integrations/gmail/')) { const handled = await handleGmailIntegration(req, res); if (handled !== false) return true; }

    if (url.startsWith('/api/v1/workforce/employees')) { await handleEmployeeRequest(req, res); return true; }
    if (url === '/api/v1/workforce/knowledge/ingest' && method === 'POST') { await handleKnowledgeIngest(req, res); return true; }
    if (url === '/api/v1/workforce/knowledge' && method === 'GET') { await handleKnowledgeList(req, res); return true; }
    if (url === '/api/v1/workforce/activity-logs' && method === 'GET') { await handleActivityLogs(req, res); return true; }
    if (url === '/api/v1/workforce/approvals' && ['GET'].includes(method)) { await handleApprovals(req, res); return true; }
    if (url.startsWith('/api/v1/workforce/approvals/') && (method === 'PATCH' || (method === 'POST' && url.endsWith('/decision')))) { await handleApprovals(req, res); return true; }
    if (url === '/api/v1/workforce/integrations' && method === 'GET') { await handleIntegrations(req, res); return true; }

    if (method === 'GET' && url === '/api/v1/workforce/chat/history') {
      await handleChatHistory(req, res);
      return true;
    }

    if (method === 'GET' && url.startsWith('/api/v1/workforce/chat/') && url.endsWith('/status')) {
      await handleChatStatus(req, res);
      return true;
    }

    // POST /api/v1/workforce/tasks
    if ((url === '/api/v1/workforce/tasks' || url === '/api/v1/workforce/chat') && method === 'POST') {
      try {
        await handleTaskSubmit(req, res);
      } catch (err) {
        console.error('[API] Unhandled error in /api/v1/workforce/tasks:', err);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
      return true;
    }

    // GET /api/v1/access
    if (url === '/api/v1/access' && method === 'GET') {
      try {
        const handled = await handleAccessRequest(req, res);
        return handled ?? true;
      } catch (err) {
        console.error('[API] Unhandled error in /api/v1/access:', err);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
        return true;
      }
    }

    // Applications workflow
    if (url === '/api/v1/applications' || url.startsWith('/api/v1/applications/')) {
      try {
        const handled = await handleApplicationsRequest(req, res);
        return handled ?? true;
      } catch (err) {
        console.error('[API] Unhandled error in /api/v1/applications:', err);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
        return true;
      }
    }

    if ((url === '/api/v1/crm/contacts' || url.startsWith('/api/v1/crm/contacts/') || url === '/api/v1/crm/leads' || url.startsWith('/api/v1/crm/leads/') || url === '/api/v1/crm/accounts/summary' || url === '/api/v1/crm/projects' || url.startsWith('/api/v1/crm/projects/')) && ['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
      try { await handleCRMRequest(req, res); } catch (err) {
        console.error('[API] CRM contacts error:', err);
        if (!res.writableEnded) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Internal server error' })); }
      }
      return true;
    }

    // Future routes go here:
    // GET /api/v1/workforce/tasks/:id
    // GET /api/v1/workforce/tasks/:id/logs
    // etc.

    return false;
  };
}
