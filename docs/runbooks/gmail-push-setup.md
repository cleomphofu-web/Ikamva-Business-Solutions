# Gmail Push Notifications — Operator Runbook

**Applies to:** Ikamva AI OS backend  
**Last updated:** September 2026  
**Scope:** Steps needed to activate Gmail Pub/Sub push notifications for a tenant. The polling fallback (`scheduleEmailTriage`) works without any of this — complete this runbook only when you want sub-30-second email pickup latency.

---

## Prerequisites

| Requirement | Where |
|-------------|-------|
| Gmail OAuth connected for the tenant | Dashboard → Tools → Gmail |
| Backend publicly reachable via HTTPS | Production domain or tunnel (see §5) |
| Tenant's `webhook_token` set in DB | Run `SELECT webhook_token FROM tenants WHERE id = '<tenant_id>';` (stores SHA-256 digest; pass raw token in query param) |
| GCP project with billing enabled | console.cloud.google.com |

---

## Step 1 — Enable APIs in GCP

In the [GCP Console](https://console.cloud.google.com/) for your project:

1. Navigate to **APIs & Services → Library**.
2. Enable **Gmail API** (if not already enabled for OAuth).
3. Enable **Cloud Pub/Sub API**.

---

## Step 2 — Create the Pub/Sub topic

```bash
gcloud pubsub topics create gmail-push \
  --project=<YOUR_GCP_PROJECT_ID>
```

Or via the console: **Pub/Sub → Topics → Create topic** named `gmail-push`.

Note the full resource name — you will need it:
```
projects/<YOUR_GCP_PROJECT_ID>/topics/gmail-push
```

---

## Step 3 — Grant Gmail publish permission

Google's Gmail servers use the service account `gmail-api-push@system.gserviceaccount.com`
to publish to your topic. This is a **Google-managed account** — you do not create it.

Grant it the `roles/pubsub.publisher` role on your topic:

```bash
gcloud pubsub topics add-iam-policy-binding gmail-push \
  --project=<YOUR_GCP_PROJECT_ID> \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

> [!IMPORTANT]
> Without this step, Gmail's watch registration will succeed but no messages will ever be delivered.

---

## Step 4 — Create the push subscription

Replace `<YOUR_BACKEND_URL>` with the full HTTPS URL of your backend and `<WEBHOOK_TOKEN>`
with the tenant's `webhook_token` from the database.

```bash
gcloud pubsub subscriptions create gmail-push-sub \
  --project=<YOUR_GCP_PROJECT_ID> \
  --topic=gmail-push \
  --push-endpoint="https://<YOUR_BACKEND_URL>/api/v1/webhooks/gmail/push?token=<WEBHOOK_TOKEN>" \
  --ack-deadline=30
```

> [!NOTE]
> The `ack-deadline=30` (seconds) gives the handler enough time to fetch the history delta
> and enqueue tasks before Pub/Sub considers the message unacknowledged. Our handler returns
> 204 immediately regardless, so delivery will succeed in well under 1 second in practice.

---

## Step 5 — (Local dev only) Expose the backend with a tunnel

Gmail push notifications require a **publicly reachable HTTPS URL**. In local development,
use [ngrok](https://ngrok.com/) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/):

```bash
# ngrok example — exposes port 5173 (dev server) or 3001 (worker API if separate)
ngrok http 5173
```

Use the `https://xxxxx.ngrok.io` URL in Step 4 instead of your production domain.

> [!WARNING]
> Do not use a local/tunnel URL in the production push subscription. Create a separate
> subscription for local testing or use the polling fallback during development.

---

## Step 6 — Set the environment variable

Add to your `.env` (and to the production secrets manager / Railway / Render variables):

```env
PUBSUB_TOPIC=projects/<YOUR_GCP_PROJECT_ID>/topics/gmail-push
```

Restart the worker process after adding this variable.

---

## Step 7 — Register the Gmail watch

After the backend is deployed with `PUBSUB_TOPIC` set, register the watch via the API.
You need a valid bearer token for the tenant's account:

```bash
curl -X POST https://<YOUR_BACKEND_URL>/api/v1/integrations/gmail/watch \
  -H "Authorization: Bearer <USER_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "watch_registered": true,
  "history_id": "1234567",
  "expiry": "2026-09-23T17:00:00.000Z"
}
```

The watch expires after at most 7 days. The worker process automatically renews it on
startup (`renewGmailWatch`) if within 24 hours of expiry.

---

## Step 8 — Verify end-to-end

1. Send a test email to the connected Gmail inbox.
2. Watch the worker logs (within 30 seconds):
   ```
   [GmailPush] gmail_push_received { tenantId, historyId }
   [GmailPush] email_triage_enqueued { tenantId, enqueued: 1, total: 1 }
   ```
3. Confirm an `email_triage` task appears in the Dashboard task queue within 30 seconds.

If you see `gmail_push_received` but no `email_triage_enqueued`, check:
- The `tenant_integrations.push_history_id` is being stored correctly.
- The Gmail history list is returning `messagesAdded` events (not just label changes).

If you see nothing after sending an email:
- Verify the push subscription URL is reachable: `curl -X POST "<push_endpoint>"` should return 204.
- Check GCP Pub/Sub → Subscriptions → `gmail-push-sub` → Metrics → Undelivered message count.
- Verify the `gmail-api-push@system.gserviceaccount.com` IAM policy (Step 3).

---

## Renewal and expiry

| When | What happens |
|------|-------------|
| Worker restarts | `renewGmailWatch()` runs; renews if within 24h of expiry or never registered |
| Dashboard → Gmail → Disconnect | `stopWatch()` is called; push columns cleared; polling takes over |
| Dashboard → Gmail → Watch → POST | Manual re-registration; use after reconnecting Gmail |
| Watch expires unrenewed | Polling fallback (`scheduleEmailTriage` every 5 min) continues automatically |

---

## Stopping push (revert to polling only)

```bash
curl -X DELETE https://<YOUR_BACKEND_URL>/api/v1/integrations/gmail/watch \
  -H "Authorization: Bearer <USER_JWT_TOKEN>"
```

Then remove or unset `PUBSUB_TOPIC` from your environment and restart the worker.
The polling loop will pick up new emails within 5 minutes as before.
