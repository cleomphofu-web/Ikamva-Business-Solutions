/**
 * GmailMCPProvider
 *
 * send()               — scaffold path: parks the action for human approval.
 *                        Used when oauthEnabled = false (default).
 * sendWithCredential() — live path: called by WorkerEngine after human approves.
 *                        Decrypts stored refresh token, exchanges for access token,
 *                        then POSTs the email via the Gmail REST API.
 *                        Never exposes credentials to the browser or logs.
 */
import { decryptRefreshToken } from '../services/GmailOAuthService.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL   = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export class GmailMCPProvider {
  constructor({ oauthEnabled = false } = {}) {
    this.oauthEnabled = oauthEnabled;
    this.name = 'gmail-mcp';
  }

  // -- Scaffold / approval-gate path -----------------------------------------

  async send(payload = {}) {
    return this.execute({ payload, task: { id: payload.metadata?.task_id ?? null } });
  }

  async execute({ payload, task }) {
    if (!this.oauthEnabled) {
      return {
        provider: this.name,
        model: null,
        task_id: task?.id ?? null,
        output: {
          status: 'awaiting_approval',
          content: 'Gmail action queued for human approval.',
          action: payload,
        },
      };
    }
    throw new Error('Gmail OAuth is not enabled on this provider instance.');
  }

  // -- Live send path (called post-approval by WorkerEngine) -----------------

  /**
   * @param {object} options
   * @param {{ to: string, subject: string, text: string, html?: string }} options.payload
   * @param {string}  options.credentialReference  Encrypted refresh token from tenant_integrations
   * @returns {{ provider, message_id, thread_id, recipient, subject }}
   */
  async sendWithCredential({ payload, credentialReference }) {
    if (!credentialReference) throw new Error('Gmail send requires a credential_reference.');

    // 1. Decrypt + exchange for a fresh access token (server-side only)
    const refreshToken = decryptRefreshToken(credentialReference);
    const accessToken  = await this._exchangeRefreshToken(refreshToken);

    // 2. Build RFC 2822 message
    const raw = this._buildMimeMessage(payload);

    // 3. Call Gmail API
    const response = await fetch(GMAIL_SEND_URL, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(`Gmail API error ${response.status}: ${body?.error?.message ?? JSON.stringify(body)}`);
    }

    return {
      provider:  this.name,
      message_id: body.id,
      thread_id:  body.threadId,
      recipient:  payload.to,
      subject:    payload.subject,
    };
  }

  // -- Private helpers -------------------------------------------------------

  async _exchangeRefreshToken(refreshToken) {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     process.env.GOOGLE_CLIENT_ID     ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      }),
    });
    const body = await response.json();
    if (!response.ok || !body.access_token) {
      throw new Error(`Gmail token refresh failed: ${body?.error_description ?? body?.error ?? 'unknown'}`);
    }
    return body.access_token;
  }

  /**
   * Encodes a plain-text (and optionally HTML) email as base64url-encoded RFC 2822.
   */
  _buildMimeMessage({ to, subject, text, html }) {
    const boundary = `boundary_${Date.now()}`;
    let message;

    if (html) {
      message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        text || '',
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        html,
        '',
        `--${boundary}--`,
      ].join('\r\n');
    } else {
      message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        text || '',
      ].join('\r\n');
    }

    return Buffer.from(message).toString('base64url');
  }
}
