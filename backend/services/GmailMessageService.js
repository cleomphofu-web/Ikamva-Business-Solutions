/** Server-side Gmail operations used by triage and response workers. */
import { decryptRefreshToken, encryptRefreshToken } from './GmailOAuthService.js';
import { IntegrationError } from '../lib/errors.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
export class GmailMessageService {
  constructor({ tenantIntegrations } = {}) { this.tenantIntegrations = tenantIntegrations; this.drafts = new Map(); this.sent = new Map(); }
  async token(reference, { tenantId } = {}) {
    if (!reference) throw new Error('Gmail credential is required.');
    const integration = tenantId && this.tenantIntegrations ? await this.tenantIntegrations.findByProvider(tenantId, 'gmail') : null;
    const refreshBefore = Date.now() + 5 * 60 * 1000;
    if (integration?.access_token_encrypted && integration.access_token_expires_at && new Date(integration.access_token_expires_at).getTime() > refreshBefore) {
      return decryptRefreshToken(integration.access_token_encrypted);
    }
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decryptRefreshToken(reference), client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '' }) });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error(data?.error_description || data?.error || 'Gmail access token refresh failed.');
      if (tenantId && this.tenantIntegrations) {
        await this.tenantIntegrations.upsert(tenantId, { provider: 'gmail', status: 'connected', access_token_encrypted: encryptRefreshToken(data.access_token), access_token_expires_at: new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString(), last_refreshed_at: new Date().toISOString() });
      }
      return data.access_token;
    } catch (error) {
      if (tenantId && this.tenantIntegrations) await this.tenantIntegrations.disconnect(tenantId, 'gmail').catch(() => undefined);
      throw new IntegrationError('Gmail authorization expired or was revoked. Reconnect Gmail to continue.', 'gmail', { cause: error?.message });
    }
  }
  async request(path, reference, options = {}) {
    const { tenantId, ...requestOptions } = options;
    const response = await fetch(`${API}${path}`, { ...requestOptions, headers: { Authorization: `Bearer ${await this.token(reference, { tenantId })}`, 'Content-Type': 'application/json', ...(requestOptions.headers || {}) } });
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) throw new Error(`Gmail API error ${response.status}: ${data?.error?.message || 'request failed'}`);
    return data;
  }
  listUnread({ credentialReference, maxResults = 25, tenantId } = {}) { return this.request(`/messages?q=${encodeURIComponent('is:unread in:anywhere')}&maxResults=${Math.min(maxResults, 100)}`, credentialReference, { tenantId }); }
  getMessage({ credentialReference, messageId, tenantId } = {}) { return this.request(`/messages/${encodeURIComponent(messageId)}?format=full`, credentialReference, { tenantId }); }
  markRead(reference, id, tenantId) { return this.request(`/messages/${encodeURIComponent(id)}/modify`, reference, { method: 'POST', body: JSON.stringify({ removeLabelIds: ['UNREAD'] }), tenantId }); }
  getDraft(reference, id, tenantId) { if (process.env.MOCK_GMAIL === 'true') return Promise.resolve(this.drafts.get(id) || null); return this.request(`/drafts/${encodeURIComponent(id)}`, reference, { tenantId }); }
  updateDraft(reference, id, { raw, threadId } = {}, tenantId) { if (process.env.MOCK_GMAIL === 'true') { const existing = this.drafts.get(id); if (!existing) return Promise.resolve(null); const updated = { ...existing, message: { raw, threadId } }; this.drafts.set(id, updated); return Promise.resolve(updated); } return this.request(`/drafts/${encodeURIComponent(id)}`, reference, { method: 'PUT', body: JSON.stringify({ id, message: { raw, threadId: threadId || undefined } }), tenantId }); }
  deleteDraft(reference, id, tenantId) { if (process.env.MOCK_GMAIL === 'true') { this.drafts.delete(id); return Promise.resolve(null); } return this.request(`/drafts/${encodeURIComponent(id)}`, reference, { method: 'DELETE', tenantId }); }
  createDraft(reference, { raw, threadId } = {}, tenantId) { if (process.env.MOCK_GMAIL === 'true') { const id = `mock-draft-${Date.now()}-${this.drafts.size + 1}`; const draft = { id, message: { raw, threadId } }; this.drafts.set(id, draft); console.log('[MockGmail] draft created', { id, threadId }); return Promise.resolve(draft); } return this.request('/drafts', reference, { method: 'POST', body: JSON.stringify({ message: { raw, threadId: threadId || undefined } }), tenantId }); }
  sendDraft(reference, id, tenantId) { if (process.env.MOCK_GMAIL === 'true') { const draft = this.drafts.get(id); if (!draft) return Promise.reject(new Error(`Mock Gmail draft not found: ${id}`)); this.drafts.delete(id); this.sent.set(id, draft); console.log('[MockGmail] draft sent', { id }); return Promise.resolve({ id, message_id: id, thread_id: draft.message.threadId, recipient: null, subject: null }); } return this.request(`/drafts/${encodeURIComponent(id)}/send`, reference, { method: 'POST', body: JSON.stringify({}), tenantId }); }

  /**
   * Register a Gmail push watch. Google will publish a Pub/Sub message to
   * `topicName` whenever new mail arrives. The response includes the historyId
   * to use as the startHistoryId for subsequent history.list() calls, and an
   * expiration timestamp (epoch ms) — Google enforces a maximum of 7 days.
   */
  watch({ credentialReference, tenantId, topicName } = {}) {
    if (process.env.MOCK_GMAIL === 'true') {
      const historyId = String(Date.now());
      const expiration = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
      console.log('[MockGmail] watch registered', { topicName, historyId, expiration });
      return Promise.resolve({ historyId, expiration });
    }
    return this.request('/watch', credentialReference, {
      method: 'POST',
      body: JSON.stringify({ topicName, labelIds: ['INBOX'], labelFilterBehavior: 'INCLUDE' }),
      tenantId,
    });
  }

  /**
   * Stop a previously registered Gmail push watch. Safe to call even if no
   * watch is active — the API returns 204 in that case.
   */
  stopWatch({ credentialReference, tenantId } = {}) {
    if (process.env.MOCK_GMAIL === 'true') {
      console.log('[MockGmail] watch stopped');
      return Promise.resolve(null);
    }
    return this.request('/stop', credentialReference, { method: 'POST', body: JSON.stringify({}), tenantId });
  }

  /**
   * Fetch the Gmail history list starting from `startHistoryId`.
   * Returns only `messagesAdded` events; other event types (labels, deletions)
   * are filtered out because we only care about new arrivals.
   * Result shape: [{ messageId, threadId }, ...]
   */
  async listHistory({ credentialReference, tenantId, startHistoryId } = {}) {
    if (process.env.MOCK_GMAIL === 'true') {
      return [];
    }
    const params = new URLSearchParams({
      startHistoryId: String(startHistoryId),
      historyTypes: 'messageAdded',
    });
    const data = await this.request(`/history?${params}`, credentialReference, { tenantId });
    const records = data?.history || [];
    const seen = new Set();
    const result = [];
    for (const record of records) {
      for (const added of (record.messagesAdded || [])) {
        const id = added.message?.id;
        const threadId = added.message?.threadId;
        if (id && !seen.has(id)) { seen.add(id); result.push({ messageId: id, threadId: threadId || null }); }
      }
    }
    return result;
  }
}
