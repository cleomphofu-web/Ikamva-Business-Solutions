/**
 * gmail-push.js
 *
 * Handles POST /api/v1/webhooks/gmail/push
 *
 * Google Pub/Sub delivers a push notification to this endpoint whenever Gmail
 * receives a new message in a watched inbox. The body is a standard Pub/Sub
 * push envelope:
 *
 *   {
 *     "message": {
 *       "data": "<base64url-encoded JSON>",   // { emailAddress, historyId }
 *       "messageId": "...",
 *       "publishTime": "..."
 *     },
 *     "subscription": "projects/.../subscriptions/..."
 *   }
 *
 * Security model:
 *   The Pub/Sub push subscription URL must include `?token=<webhook_token>`.
 *   We validate this token against `tenants.webhook_token` before processing.
 *   Even on error we return 204 to prevent Pub/Sub retry storms — all errors
 *   are logged to console.error for operator visibility.
 *
 * Enqueue contract:
 *   One `email_triage` task per new message ID, idempotency key =
 *   `email_triage_<messageId>`. The task payload mirrors what the polling path
 *   sends (credential_reference + message_id + optional thread_id).
 */
import crypto from 'node:crypto';
import { getRootContainer } from './workforce.js';
import { createTenantExecutionContainer } from '../container/createExecutionContainer.js';
import { IpRateLimiter } from '../services/IpRateLimiter.js';

const limiter = new IpRateLimiter();

/** Always ack to Pub/Sub — never let retries pile up. */
const ack = (res) => { res.writeHead(204); res.end(); };

export async function handleGmailPush(req, res) {
  const ip = req.socket?.remoteAddress
    || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || 'unknown';

  const rate = limiter.check(ip);
  if (!rate.allowed) {
    // Still ack to Pub/Sub — rate limiting is an operator concern, not a
    // signal to retry.
    console.warn('[GmailPush] rate limited', { ip });
    return ack(res);
  }

  // ── Token validation ──────────────────────────────────────────────────────
  const token = new URL(req.url, 'http://127.0.0.1').searchParams.get('token');
  if (!token) {
    console.error('[GmailPush] missing token param');
    return ack(res);
  }

  let tenant;
  try {
    const tenantRepository = getRootContainer().resolve('repositoryFactory').forSystem().tenants;
    tenant = await tenantRepository.findByWebhookToken(token);
  } catch (err) {
    console.error('[GmailPush] tenant lookup failed', { error: err?.message });
    return ack(res);
  }

  if (!tenant) {
    console.warn('[GmailPush] invalid token', {
      token_fingerprint: crypto.createHash('sha256').update(token).digest('hex').slice(0, 12),
    });
    return ack(res);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let rawBody = '';
  try {
    for await (const chunk of req) rawBody += chunk;
  } catch (err) {
    console.error('[GmailPush] body read failed', { tenantId: tenant.id, error: err?.message });
    return ack(res);
  }

  let envelope;
  try {
    envelope = JSON.parse(rawBody || '{}');
  } catch {
    console.error('[GmailPush] invalid JSON body', { tenantId: tenant.id });
    return ack(res);
  }

  // ── Decode Pub/Sub message ────────────────────────────────────────────────
  let pushData;
  try {
    const encoded = envelope?.message?.data;
    if (!encoded) throw new Error('Missing message.data in Pub/Sub envelope');
    pushData = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch (err) {
    console.error('[GmailPush] failed to decode Pub/Sub data', { tenantId: tenant.id, error: err?.message });
    return ack(res);
  }

  const incomingHistoryId = pushData?.historyId ? Number(pushData.historyId) : null;
  if (!incomingHistoryId) {
    console.warn('[GmailPush] Pub/Sub message has no historyId', { tenantId: tenant.id, pushData });
    return ack(res);
  }

  console.info('[GmailPush] gmail_push_received', {
    tenantId: tenant.id,
    emailAddress: pushData.emailAddress,
    historyId: incomingHistoryId,
  });

  // ── Process new messages ──────────────────────────────────────────────────
  try {
    const scoped = createTenantExecutionContainer({
      tenantId: tenant.id,
      rootContainer: getRootContainer(),
    });

    const repos = scoped.resolve('repositories');
    const integration = await repos.tenantIntegrations.findByProvider('gmail');

    if (!integration || integration.status !== 'connected' || !integration.credential_reference) {
      console.warn('[GmailPush] Gmail integration not connected', { tenantId: tenant.id });
      return ack(res);
    }

    // Fetch the history delta between the stored anchor and the incoming historyId.
    const watchService = scoped.resolve('gmailWatchService');
    const startHistoryId = integration.push_history_id || incomingHistoryId;
    const newMessages = await watchService.listNewMessages(
      integration.credential_reference,
      tenant.id,
      startHistoryId,
    );

    // Advance the stored historyId so the next push starts from here.
    await repos.tenantIntegrations.upsert({
      provider: 'gmail',
      push_history_id: incomingHistoryId,
    });

    if (newMessages.length === 0) {
      console.info('[GmailPush] no new messages in history delta', { tenantId: tenant.id, startHistoryId });
      return ack(res);
    }

    const queueService = scoped.resolve('queueService');
    const employee = await repos.employees.findByTenant();
    const clientProfileId = employee?.client_profile_id ?? null;

    let enqueued = 0;
    for (const { messageId, threadId } of newMessages) {
      try {
        await queueService.enqueueTask({
          tenant_id: tenant.id,
          client_profile_id: clientProfileId,
          task_type: 'email_triage',
          idempotency_key: `email_triage_${messageId}`,
          payload: {
            credential_reference: integration.credential_reference,
            message_id: messageId,
            thread_id: threadId || null,
            message: '',
            source: 'gmail_push',
          },
        });
        enqueued++;
      } catch (err) {
        // Likely an idempotency collision — already enqueued by polling. Log and continue.
        console.warn('[GmailPush] enqueue skipped (duplicate?)', { tenantId: tenant.id, messageId, error: err?.message });
      }
    }

    console.info('[GmailPush] email_triage_enqueued', {
      tenantId: tenant.id,
      enqueued,
      total: newMessages.length,
    });
  } catch (err) {
    // Non-ack-able error — log for operator but still ack to prevent Pub/Sub retries.
    console.error('[GmailPush] processing error', { tenantId: tenant.id, error: err?.message, stack: err?.stack });
  }

  return ack(res);
}
