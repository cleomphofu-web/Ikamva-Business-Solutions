import crypto from 'node:crypto';
import { getRootContainer } from './workforce.js';
import { createTenantExecutionContainer } from '../container/createExecutionContainer.js';
import { IpRateLimiter } from '../services/IpRateLimiter.js';
const limiter = new IpRateLimiter();
const json = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(body)); return true; };
export async function handleWebhookRequest(req, res) {
  const match = req.url?.split('?')[0]?.match(/^\/api\/v1\/webhooks\/([^/]+)$/);
  if (!match || req.method !== 'POST') return false;
  const ip = req.socket?.remoteAddress || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const rate = limiter.check(ip);
  if (!rate.allowed) return json(res, 429, { error: 'Too many webhook requests. Try again later.' }, { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) });
  const token = match[1];
  const tenantRepository = getRootContainer().resolve('repositoryFactory').forSystem().tenants;
  const tenant = await tenantRepository.findByWebhookToken(token);
  if (!tenant) { console.warn('[Webhook] failed token lookup', { ip, token_fingerprint: crypto.createHash('sha256').update(token).digest('hex').slice(0, 12) }); return json(res, 401, { error: 'Invalid webhook token' }); }
  let body = ''; for await (const chunk of req) body += chunk;
  let payload; try { payload = JSON.parse(body || '{}'); } catch { return json(res, 400, { error: 'Request body must be valid JSON' }); }
  const scoped = createTenantExecutionContainer({ tenantId: tenant.id, rootContainer: getRootContainer() });
  const task = await scoped.resolve('queueService').enqueueTask({ tenant_id: tenant.id, task_type: payload.task_type || 'chat', idempotency_key: payload.idempotency_key || `webhook:${crypto.randomUUID()}`, payload: payload.payload || payload });
  return json(res, 202, { task_id: task.id });
}
