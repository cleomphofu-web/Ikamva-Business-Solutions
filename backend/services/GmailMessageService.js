/** Server-side Gmail operations used by triage and response workers. */
import { decryptRefreshToken } from './GmailOAuthService.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
export class GmailMessageService {
  async token(reference) {
    if (!reference) throw new Error('Gmail credential is required.');
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decryptRefreshToken(reference), client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '' }) });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error('Gmail access token refresh failed.');
    return data.access_token;
  }
  async request(path, reference, options = {}) {
    const response = await fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${await this.token(reference)}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) throw new Error(`Gmail API error ${response.status}: ${data?.error?.message || 'request failed'}`);
    return data;
  }
  listUnread({ credentialReference, maxResults = 25 } = {}) { return this.request(`/messages?q=${encodeURIComponent('is:unread in:anywhere')}&maxResults=${Math.min(maxResults, 100)}`, credentialReference); }
  getMessage({ credentialReference, messageId } = {}) { return this.request(`/messages/${encodeURIComponent(messageId)}?format=full`, credentialReference); }
  markRead(reference, id) { return this.request(`/messages/${encodeURIComponent(id)}/modify`, reference, { method: 'POST', body: JSON.stringify({ removeLabelIds: ['UNREAD'] }) }); }
  deleteDraft(reference, id) { return this.request(`/drafts/${encodeURIComponent(id)}`, reference, { method: 'DELETE' }); }
  createDraft(reference, { raw, threadId } = {}) { return this.request('/drafts', reference, { method: 'POST', body: JSON.stringify({ message: { raw, threadId: threadId || undefined } }) }); }
  sendDraft(reference, id) { return this.request(`/drafts/${encodeURIComponent(id)}/send`, reference, { method: 'POST', body: JSON.stringify({}) }); }
}
