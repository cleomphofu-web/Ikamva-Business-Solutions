/**
 * GmailWatchService
 *
 * Manages the lifecycle of Gmail push watch registrations.
 * A "watch" tells Gmail to publish a Pub/Sub message whenever new mail arrives
 * in the registered inbox, instead of us having to poll every 5 minutes.
 *
 * Responsibilities:
 *  - Register a new watch for a tenant's Gmail integration
 *  - Renew a watch that is approaching expiry (Google enforces max 7 days)
 *  - Stop a watch (on disconnect or explicit opt-out)
 *  - Fetch the history delta after a push notification arrives
 *
 * This service does NOT touch the queue or enqueue tasks. It is a pure
 * Gmail API / integration-state adapter. Task enqueueing happens in the
 * gmail-push webhook handler (backend/api/gmail-push.js).
 *
 * Dependency: GmailMessageService (injected) for the raw API calls.
 *             TenantIntegrationRepository (injected) to persist push metadata.
 */
export class GmailWatchService {
  /**
   * @param {object} options
   * @param {import('../services/GmailMessageService.js').GmailMessageService} options.gmailMessageService
   * @param {object} options.tenantIntegrations  - tenant-scoped integration repository
   * @param {string} options.topicName           - full Pub/Sub topic resource name,
   *                                               e.g. "projects/my-project/topics/gmail-push"
   */
  constructor({ gmailMessageService, tenantIntegrations, topicName } = {}) {
    this.gmail = gmailMessageService;
    this.tenantIntegrations = tenantIntegrations;
    this.topicName = topicName || process.env.PUBSUB_TOPIC || null;
  }

  /**
   * Register (or re-register) a Gmail push watch for the given tenant.
   *
   * Stores the returned historyId and expiration into tenant_integrations so the
   * push webhook handler has them available on every notification.
   *
   * @param {string} credentialReference  - encrypted refresh token reference
   * @param {string} tenantId
   * @returns {{ historyId: string, expiration: string }}  raw Gmail API response
   */
  async registerWatch(credentialReference, tenantId) {
    if (!this.topicName) {
      throw new Error('GmailWatchService: PUBSUB_TOPIC is not configured. Cannot register watch.');
    }

    const result = await this.gmail.watch({
      credentialReference,
      tenantId,
      topicName: this.topicName,
    });

    // expiration is epoch-ms as a string; convert to ISO for storage.
    const pushExpiry = result?.expiration
      ? new Date(Number(result.expiration)).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const historyId = result?.historyId ? BigInt(result.historyId) : null;

    await this.tenantIntegrations.upsert({
      provider: 'gmail',
      push_expiry: pushExpiry,
      push_history_id: historyId ? Number(historyId) : null,
    });

    console.info('[GmailWatchService] watch registered', { tenantId, pushExpiry, historyId: historyId?.toString() });
    return result;
  }

  /**
   * Stop the Gmail push watch for the given tenant.
   * Clears the push columns so the polling fallback takes over cleanly.
   *
   * @param {string} credentialReference
   * @param {string} tenantId
   */
  async stopWatch(credentialReference, tenantId) {
    await this.gmail.stopWatch({ credentialReference, tenantId });
    await this.tenantIntegrations.upsert({
      provider: 'gmail',
      push_expiry: null,
      push_history_id: null,
    });
    console.info('[GmailWatchService] watch stopped', { tenantId });
  }

  /**
   * Renew the watch only if it is within 24 hours of expiry (or has never been
   * registered). Designed to be called from worker-process.js startup so watches
   * are kept live without manual intervention.
   *
   * @param {object} integration  - row from tenant_integrations (must include push_expiry)
   * @param {string} credentialReference
   * @param {string} tenantId
   * @returns {boolean}  true if a renewal was performed
   */
  async renewWatchIfNeeded(integration, credentialReference, tenantId) {
    if (!this.topicName) {
      // Push not configured — polling fallback handles triage.
      return false;
    }

    const expiry = integration?.push_expiry ? new Date(integration.push_expiry) : null;
    const renewalThresholdMs = 24 * 60 * 60 * 1000; // 24 hours
    const needsRenewal = !expiry || expiry.getTime() - Date.now() < renewalThresholdMs;

    if (!needsRenewal) {
      return false;
    }

    try {
      await this.registerWatch(credentialReference, tenantId);
      return true;
    } catch (err) {
      // Non-fatal: polling fallback will continue.
      console.error('[GmailWatchService] watch renewal failed, polling fallback active', {
        tenantId,
        error: err?.message,
      });
      return false;
    }
  }

  /**
   * Fetch the list of message IDs that arrived after `startHistoryId`.
   * Called by the push webhook handler immediately after receiving a notification.
   *
   * @param {string} credentialReference
   * @param {string} tenantId
   * @param {number|string} startHistoryId
   * @returns {Array<{ messageId: string, threadId: string|null }>}
   */
  async listNewMessages(credentialReference, tenantId, startHistoryId) {
    if (!startHistoryId) {
      // No history anchor available — return empty and let the next polling
      // cycle pick up via the full unread scan.
      console.warn('[GmailWatchService] listNewMessages called without startHistoryId', { tenantId });
      return [];
    }

    return this.gmail.listHistory({
      credentialReference,
      tenantId,
      startHistoryId,
    });
  }
}
