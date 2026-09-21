# Ikamva — Agents & Implementation Plan
**Version:** 2.1 — Updated with consolidated specification additions

---

# Part 1 — Agent Definitions

## Agent 1: EmailTriageWorker
**Purpose:** Continuously processes incoming Gmail messages and routes them to the correct chain.

**Trigger:** Scheduled — runs every 5 minutes for each tenant with a connected Gmail integration and an active Employee (`lifecycle_status = 'active'` only — never draft, paused, or blocked).

**Inputs:**
- Tenant's Gmail OAuth token (decrypted from tenant_integrations, auto-refreshed if expiring)
- List of unread messages from Gmail API

**Steps:**
1. Fetch unread emails via Gmail MCP adapter
2. For each message: check idempotency key (`email_triage_{gmail_message_id}`) — skip if already processed
3. Call AI provider (lightweight, fast model): classify email category and whether it requires a response
4. Check tenant has the required skill for that category AND skill is in their plan
5. Check employee `autonomy_mode` — if `observe`, log recommendation only, do not enqueue
6. If actionable: enqueue the appropriate chain
7. If not: mark as read, write `email_skipped` memory row with reason

**Output:** One or more task chain parent tasks enqueued, or email marked read and skipped.

**Failure mode:** Gmail token expired → throw IntegrationError → integration set to disconnected → employee set to `needs_attention` → tenant notified.

---

## Agent 2: EmailResponseWorker (Chain Orchestrator)
**Purpose:** Executes the full quote/support/CRM chain for a single email that requires a response.

**Trigger:** Enqueued by EmailTriageWorker when `requires_response: true` and autonomy mode permits action.

**Chain steps:**

### Step 1: email_read
- Extracts: sender email, name (if available), subject, body, thread_id, message_id
- Stores in chain context: `{ sender, subject, body, thread_id, message_id }`
- No external calls

### Step 2: crm_lookup (non-required)
- Queries `crm_contacts` WHERE `email = sender.email` AND `tenant_id = task.tenant_id`
- If found: adds to context `{ customer_name, company, account_tier, contact_id }`
- If not found: adds `{ is_new_lead: true }` — chain continues
- On failure: logs `crm_lookup_failed`, chain continues (non-required step)

### Step 3: quote_generate / response_generate
- Assembles full context:
  - Employee system prompt from `ai_employees.configuration.system_prompt`
  - Top 3 Company Brain chunks via cosine similarity against email body
  - Last 10 memory rows for employee, filtered by thread_id if available
  - Customer context from step 2
  - Original email from step 1
- Calls AI provider
- Requests confidence self-assessment in same call (see Part 6 — Confidence Scoring)
- Stores generated content in chain context: `{ response_content, confidence_score, confidence_reason }`

### Step 4: email_draft
- Formats response_content as a branded email
- Creates Gmail draft in the original thread via Gmail MCP adapter
- Stores: `{ draft_id, draft_preview, subject_line }` in chain context and approval payload

### Step 5: approval_gate
- Checks action risk class for `send_email` — always `high`, always requires approval
- Creates `approval_queue` record with: full action payload, `confidence_score`, `confidence_reason`, `draft_id`
- Sends Resend notification email to tenant owner (failure here is non-fatal — approval still created)
- Transitions task to `awaiting_human`
- Chain ticker updates to "Awaiting your approval"

### Step 6: email_send (triggered by human decision)
- Before sending: verify `draft_id` still exists in Gmail API — if deleted, fail gracefully
- Uses optimistic lock: `UPDATE approval_queue SET status='approved' WHERE id=:id AND status='pending'`
- If 0 rows affected: another device already actioned this approval — return "Already actioned"
- **On approval:**
  - Sends Gmail draft via Gmail API using `draft_id`
  - Writes `HUMAN_APPROVED → GMAIL_SENT → CHAIN_COMPLETED` to task_logs
  - Writes `email_sent` memory row with `thread_id`
- **On "edit and approve":**
  - Updates Gmail draft with edited content before sending
  - Writes `HUMAN_EDITED_AND_APPROVED → GMAIL_SENT → CHAIN_COMPLETED` to task_logs
  - Stores diff of what was changed in task_logs metadata
- **On rejection:**
  - Deletes Gmail draft via Gmail API using `draft_id`
  - Writes `HUMAN_REJECTED → CHAIN_COMPLETED` to task_logs
  - Writes `email_rejected` memory row

---

## Agent 3: ChatWorker
**Purpose:** Handles synchronous client chat with their Employee. Also serves as a control surface — clients can give instructions, ask for reports, change rules, pause work, or request one-off tasks.

**Trigger:** `POST /api/v1/workforce/chat` → enqueued as `chat` task → polled by frontend.

**Chat input types (classified before response generation):**
- `informational` — client asking a question, Employee answers from knowledge/memory
- `instruction` — client changing a rule, schedule, or behavior (requires confirmation preview)
- `task_request` — client asking Employee to do something (enqueues appropriate chain)
- `status_request` — "what did you work on today?" — answered from task_logs/memory

**Steps:**
1. Classify input type
2. Load Employee record and stored system prompt
3. Check schedule — prepend out-of-hours notice if applicable
4. Load last 20 memory rows (recent interactions)
5. Load top 3 Company Brain chunks relevant to the message
6. If `instruction`: parse the instruction, preview the change, require confirmation before storing
7. If `task_request`: enqueue appropriate chain, return acknowledgment
8. Otherwise: call AI provider, return response
9. Write response to task result
10. Write `interaction` memory row (compressed summary)
11. Write `employee_activity_logs` row with token usage

**No approval gate for informational responses** — chat that triggers real-world actions follows the chain approval flow.

---

## Agent 4: IntentParserAgent
**Purpose:** Parses a plain-language fast-track description into structured Employee configuration.

**Trigger:** `POST /api/v1/workforce/employees/parse-intent`

**Input:** Free-text string from client (e.g. "I need someone to handle customer quote requests")

**Output:**
```json
{
  "skills": ["email_management", "quotes_and_invoicing"],
  "integrations_needed": ["gmail"],
  "industry_hint": "professional_services",
  "personality_hint": "professional",
  "role_hint": "Customer Operations Specialist"
}
```

**Note:** This is a simple synchronous AI call — not queued. Fast and cheap. Output is used to pre-fill the setup form.

---

## Agent 5: DataAnalystWorker (Future — Phase 5)
**Purpose:** Answers questions about business data, generates recurring reports, identifies anomalies.

**Capabilities (when built):**
- Read approved datasets (Google Sheets, uploaded CSVs)
- Answer questions in chat with evidence citations
- Generate scheduled reports on a defined cadence
- Identify anomalies and flag them proactively
- Never modifies source data unless explicitly authorised

**Constraint:** Read-only by default. Any write action requires `autonomy_mode = 'controlled'` or `'autonomous'` AND explicit `allowed_actions` including the specific write type.

---

# Part 2 — Autonomy Model

Sourced from consolidated specification. This is the most important addition to the original design.

Every Employee has an `autonomy_mode` that determines how much it acts independently.

| Mode | Behaviour |
|---|---|
| `observe` | Reads, classifies, and summarises only. Never enqueues action chains. Logs recommendations to activity timeline. |
| `draft` | Prepares everything — drafts, CRM notes, calendar holds — but executes nothing. All output requires approval. |
| `approve` | Handles routine low/medium risk actions automatically. Routes high and very-high risk actions for approval. **Default for new Employees.** |
| `controlled` | Executes only actions in the `allowed_actions` list. Blocks and escalates anything not explicitly listed. |
| `autonomous` | Executes broadly within plan limits. Only blocks `critical` risk class actions. For advanced users only. |

### Action risk classification

```js
// backend/config/action-risk.js
module.exports = {
  'add_internal_note':      'low',       // auto-execute in approve+
  'log_crm_contact':        'medium',    // auto-execute in approve+
  'update_crm_field':       'medium',    // auto-execute in approve+
  'draft_email':            'medium',    // auto-execute in approve+
  'send_email':             'high',      // approval required in approve mode
  'book_calendar_event':    'high',      // approval required in approve mode
  'send_to_new_contact':    'very_high', // always requires approval
  'delete_crm_record':      'very_high', // always requires approval
  'issue_refund':           'critical',  // blocked in MVP
  'change_permissions':     'critical',  // blocked in MVP
  'financial_transaction':  'critical',  // blocked in MVP
}
```

### Risk class enforcement in WorkerEngine

Before any external action:
- `critical`: reject immediately with `BLOCKED_CRITICAL_ACTION`, regardless of autonomy mode
- `very_high`: always require approval, regardless of autonomy mode
- `high`: require approval unless `autonomy_mode` is `controlled` or `autonomous`
- `medium` / `low`: respect autonomy mode — auto-execute in `approve` mode and above

---

# Part 3 — Employee Lifecycle States

Extended from consolidated specification. More states than the original design.

| State | Meaning | WorkerEngine behaviour |
|---|---|---|
| `draft` | Created but not configured | No tasks processed |
| `setup_required` | Missing required integration, knowledge, or rules | No tasks processed, dashboard shows what is missing |
| `testing` | Safe test execution only — no real external actions | Test chains only, all sends are dry-run |
| `active` | Fully operational | Normal processing |
| `paused` | Triggers received but no actions executed | Queues work internally, nothing sent |
| `needs_attention` | Requires user intervention to continue | Processing stopped, dashboard shows reason and fix link |
| `blocked` | Hard stop — policy, integration, or safety issue | Processing stopped, admin notified |
| `archived` | Inactive, hidden by default | No processing, accessible from archived view |

**Automatic state transitions:**
- Integration auth fails → `needs_attention` (not `blocked` — client can reconnect)
- Chain stuck > 30 minutes → `needs_attention`
- Critical policy violation → `blocked` (requires admin review to unblock)
- Client clicks Pause → `paused`
- Client reconnects integration and resolves issue → back to `active`

---

# Part 4 — Confidence Scoring

Sourced from consolidated specification.

Every AI-generated draft includes a confidence self-assessment.

**How it works:**
In the response generation prompt, append:
```
After your response, on a new line write exactly:
CONFIDENCE: [0-100]
REASON: [one sentence explaining your confidence level, referencing what you did or did not find in the knowledge base]
```

Parse and strip from client-facing draft before storing. Store `confidence_score` (integer) and `confidence_reason` (text) on the `approval_queue` record.

**Display on approval cards:**
- 90–100: no badge — clean approval card
- 70–89: neutral note — "Confident reply based on your knowledge base"
- 50–69: amber badge — "Uncertain — please review carefully before sending"
- Below 50: red badge — "Low confidence — knowledge base may not cover this topic. Consider editing."

**Escalation rule:** If `confidence_score < 50` AND `autonomy_mode = 'approve'`, the system should proactively notify the client rather than just queuing silently. Message: "Sjava received a message she is not confident about. Review it before she drafts a reply."

---

# Part 5 — Implementation Plan

## Phase 0 — Foundation (Done)
- [x] Supabase project with RLS
- [x] Express API server
- [x] Supabase Auth integration
- [x] RepositoryFactory + tenant scoping
- [x] Task queue with retry and idempotency
- [x] WorkerEngine polling loop
- [x] ProviderRegistry (Groq + OpenAI)
- [x] TaskChainService + chain advancement
- [x] Typed error hierarchy

## Phase 1 — Working AI Employee (Done)
- [x] Employee persistence (all setup steps saved per-step)
- [x] System prompt generated on activation
- [x] Chat → queue → WorkerEngine → Groq → response
- [x] Chat history persisted and loaded on refresh
- [x] Memory written after every chat interaction
- [x] Company Brain with pgvector embeddings
- [x] Context assembly: system prompt + memory + RAG
- [x] Task chain infrastructure

## Phase 2 — Email Automation (Mostly done)
- [x] Gmail OAuth flow (connect, callback, disconnect)
- [x] Encrypted token storage
- [x] EmailTriageWorker (classify, route)
- [x] EmailResponseWorker (6-step chain)
- [x] Approval gate with Resend notification
- [x] Realtime chain ticker in Mission Control
- [x] OAuth token auto-refresh on expiry (with encrypted short-lived access-token cache and disconnect-on-revocation handling)
- [ ] Draft verified to exist before send (draft_id check)
- [ ] Concurrent approval double-send prevention (optimistic lock)
- [x] Thread memory (thread_id in email memory rows and thread-filtered prompt context)
- [ ] Startup recovery for orphaned tasks

## Phase 3 — Autonomy & Safety (Next)
- [x] `autonomy_mode` column on `ai_employees`
- [x] Action risk classification config (`action-risk.js`)
- [x] WorkerEngine enforces risk class + autonomy mode before every external action
- [x] Extended lifecycle states (`needs_attention`, `blocked`, `testing`, `setup_required`)
- [x] Confidence scoring on approval cards
- [x] "Edit and approve" on approval cards
- [x] Low-confidence proactive escalation notification

## Phase 4 — Data Integrity
- [x] localStorage retired for invoices, projects, tasks, and services; client screens use tenant-scoped API paths
- [x] Per-tenant provider-call usage windows (`tenant_usage_windows`); WorkerEngine consumes atomically before non-mock provider execution
- [x] Webhook trigger endpoint with token authentication and per-IP rate limiting
- [ ] Email verification re-enabled with dev bypass
- [x] Postgres advisory lock on triage task creation (prevents duplicate chains)
- [x] Chain prompt token-budget guard with memory/company-knowledge truncation and audit warning

## Phase 5 — UX Completeness
- [ ] Live chain thinking display in Mission Control Overview
- [x] Dashboard: 3-panel first view (approvals, activity, Employee health) with live tenant capacity data
- [x] Employee workspace page (dedicated Mission Control workspace with Context, Rules, Schedule, Skills, Tools, Approvals, Logs, and Account tabs)
- [x] Integration-connected state in Skills workspace; required scopes gate activation
- [x] Upgrade prompt after first completed value delivery, including skill-specific upsell copy
- [x] Rotating headline on landing page using CSS crossfade with reduced-motion fallback
- [x] Fast-track intent parser in Setup Step 0 with structured pre-fill suggestions
- [ ] 404 and empty states on every route (no blank screens, no broken pages)

## Phase 6 — Additional Chains
- [ ] Customer support chain
- [ ] CRM update chain
- [ ] Lead capture chain
- [ ] Scheduled report chain (Data Analyst Employee — future)

## Phase 7 — Billing & Launch
- [ ] Stripe integration for subscription management
- [ ] Plan enforcement on signup (not just at task time)
- [ ] Trial expiry handling and grace period
- [ ] Real client onboarding (not just test account)
- [ ] Production deployment (Docker + VPS)
- [ ] Custom domain email for Resend
- [ ] Google OAuth app verification (2–6 weeks — start now)
- [ ] Privacy policy and terms of service pages (required for Google OAuth verification)
- [ ] SPF/DKIM/DMARC records on sending domain

---

# Part 6 — Edge Cases Currently Missing

## Security Edge Cases

**1. Refresh token revoked mid-chain**
Client revokes Ikamva's Gmail access while a chain is in step 3. Step 4 (email_draft) fails with 401 from Gmail API. Current behaviour: untyped error. Required: `IntegrationError` thrown, chain fails cleanly, `tenant_integrations.status = 'disconnected'`, employee transitions to `needs_attention`, client notified.

**2. Gmail draft deleted before approval decision**
Approval can sit pending for days. If the client deletes the draft directly in Gmail, approving it in Ikamva will try to send a draft that no longer exists. Required: before sending, verify `draft_id` still exists via Gmail API. If missing: fail gracefully with message "This draft was deleted from Gmail — please reject and let Sjava draft a new reply."

**3. Concurrent approval from two devices**
Two admins click Approve at the same moment. Email could send twice. Required: optimistic lock — `UPDATE approval_queue SET status='approved' WHERE id=:id AND status='pending'`. If 0 rows affected: return "Already actioned" to the second caller without sending again.

**4. Webhook token enumeration**
Webhook tokens are 32-byte random URL-safe strings. Without rate limiting, an attacker can enumerate them. Required: rate limit `POST /api/v1/webhooks/:token` to 20 requests/minute per IP. Log failed token lookups for monitoring.

**5. Sensitive data in Company Brain**
Client uploads a document containing employee salaries, personal health records, or customer private data. The AI will include this in responses to anyone chatting with the Employee. Required: UI warning on every upload — "Everything you upload may be shared with people who contact your Employee. Do not upload confidential or personal data." Consider a `restricted` flag that prevents specific document chunks from appearing in customer-facing responses.

**6. Low-confidence response sent without review**
Client is on `autonomous` mode. AI generates a response with confidence 35%. Under current logic the action risk class (`send_email = high`) forces approval. But if a future role has `send_email` in `allowed_actions` with `autonomy_mode = autonomous`, the low confidence is not a hard block. Required: confidence below 50 always forces approval regardless of autonomy mode.

## Operational Edge Cases

**7. Gmail polling creates duplicate chains on restart**
EmailTriageWorker runs twice in quick succession on restart. Idempotency key prevents two triage tasks if the unique constraint catches the second insert before the first completes. Under high concurrency this can fail. Required: Postgres advisory lock per `message_id` during triage task creation — `SELECT pg_try_advisory_xact_lock(hashtext(message_id))`.

**8. Chain context exceeds provider context window**
A 6-step chain accumulates context. By step 5, the assembled prompt may contain full email body + CRM data + 500-word quote + 20 memory rows + 3 Company Brain chunks. This can exceed the model's context limit. Required: measure assembled prompt token count before calling provider. If above 80% of model limit: truncate memory rows first (oldest first), then Company Brain chunks, then log a warning to task_logs.

**9. Employee setup abandoned mid-way**
Client completes steps 1–5, never activates. Employee is in `draft` with a Gmail connection but no system prompt. EmailTriageWorker must never process for this Employee. Required: `WHERE e.lifecycle_status = 'active'` in the triage scheduler query — not just `!= 'archived'`.

**10. Plan downgrade with active chains**
Client downgrades from Professional to Starter. Existing `awaiting_human` chains include quote tasks that Starter does not cover. Required: plan enforcement at chain advance time, not just at chain creation. If plan no longer covers the next step's skill, fail the chain with: "Your plan no longer covers this task type. Upgrade to continue."

**11. Resend notification email fails**
Resend API call fails in `approval_gate` step. Chain is stuck in `awaiting_human` but client never receives the notification email. Required: treat Resend failure as non-fatal — write the approval record regardless, log the notification failure in task_logs, allow the client to see the approval in their dashboard without the email. Never fail the chain because of a notification failure.

**12. Employee chat used to bypass approval gate**
Client or malicious actor sends a chat message instructing the Employee to "send an email to john@example.com saying X". If the ChatWorker processes this as an instruction and enqueues a chain without going through the normal triage path, the normal risk classification might be bypassed. Required: any chat instruction that triggers a real-world action must go through the same WorkerEngine entitlement and risk classification checks as any other task.

**13. Multiple Employees in future — routing ambiguity**
Business plan allows 3 Employees. If a client has two Employees and both have Gmail connected to the same inbox, both would triage the same email. Required: `tenant_integrations` must enforce one Employee per integration per tenant. When multiple Employees exist, each must be connected to a distinct Gmail account.

---

# Part 7 — What Is Over-Engineered

**1. The RepositoryFactory for simple record types**
The factory pattern adds value for CRM entities where tenant scoping and multiple implementations (in-memory for test, Supabase for production) are needed. For simple records like `tenant_usage_windows` or `notifications` — records never tested with in-memory implementations — the factory adds indirection without benefit. Direct Supabase queries in the service layer would be cleaner.

**2. pgvector at current document volume**
Keyword matching would serve adequately for a Company Brain with 10–50 chunks per tenant. pgvector is the right long-term answer but cost significant implementation effort (extension, HNSW index, embedding service, separate API key). Quality improvement over keyword matching for small knowledge bases is marginal. This pays off at 200+ chunks per tenant. Right decision architecturally, wrong timing.

**3. The MCP server scaffold for Gmail**
A full Model Context Protocol server for Gmail adds complexity that a direct Gmail API client would not. The abstraction is valuable if Ikamva eventually supports many interchangeable tool types — but currently it is Gmail only, and the indirection makes the code harder to trace and debug.

**4. In-memory repository implementations**
These exist to enable unit testing without a database. In practice, the test suite uses real Supabase connections. The in-memory implementations add maintenance burden without being exercised in testing.

**5. Ten-step Employee setup**
Ten steps is too long. Clients who abandon at step 5 are a real risk. The fast-track intent parser (step 0) helps, but the underlying setup should be collapsible to 4 essential steps: Identity → Company context → Connect Gmail → Activate. Everything else (Skills, Permissions, Rules, Schedule) should have sensible defaults that clients can refine later from the Employee workspace settings. The current design front-loads all configuration before the client sees any value.

---

# Part 8 — What Will Break in Production

**1. Gmail OAuth app verification (Critical — blocking)**
Google requires OAuth apps requesting `gmail.send` to pass a verification process before accessing non-test accounts. This takes 2–6 weeks and requires: a privacy policy page, a terms of service page, a security assessment, and demonstrated compliance with Google's API Services User Data Policy. Until verified, only accounts manually added as test users in Google Cloud Console can connect Gmail. This blocks every real client. **Start the verification process immediately — it gates the entire product launch.**

**2. Email delivery reputation (High)**
Ikamva sends approval notifications via Resend from a sending domain. Without SPF, DKIM, and DMARC records correctly configured on that domain, approval emails will land in spam. Clients will miss approvals and conclude the product is broken. This needs to be verified with a real deliverability test (MXToolbox, mail-tester.com) before any real client onboards.

**3. Encryption key rotation (High)**
If `ENCRYPTION_KEY` is ever changed — server migration, team handover, security rotation — all stored encrypted OAuth tokens become permanently unreadable. Every Gmail integration will fail simultaneously with no self-service recovery path for clients. Required before launch: document the key rotation procedure, implement support for decrypting with the previous key during a transition window.

**4. Groq rate limits under real load (High)**
Groq's free tier has strict rate limits. When multiple real clients are active simultaneously — each polling Gmail every 5 minutes, each triggering chains — Groq calls will return 429 errors. The `withRetry` function handles transient failures but sustained rate limiting will cause chains to queue and eventually fail. Required: move to a paid Groq plan or switch `AI_PROVIDER=openai` before the first real client goes live.

**5. Single Supabase project (Medium)**
All tenant data is in one Supabase project. A misconfigured migration, RLS policy error, or Supabase service incident affects every client simultaneously. Required: automated database backups configured and tested, restore procedure documented and practised before launch.

**6. The 401 sign-in bug (Medium — unresolved)**
`/api/v1/access` still returns 401 after sign-in under some conditions. Diagnosed as a race condition between `signInWithPassword()` resolving and the session being available for the subsequent access check. Fix specified but browser verification was interrupted. Must be confirmed working before any client attempts to sign in.

**7. No 404 or empty states on most routes (Medium)**
The PRD states "make no page has a 404 error" and the consolidated specification explicitly requires 404 and empty states on every route. Currently, navigating to an unimplemented or wrong route likely shows a blank screen or a React error boundary. Every route in the screen inventory must have a defined loading, error, empty, and not-found state before launch.

**8. Google OAuth consent screen shows "unverified app" (Medium)**
Even after creating OAuth credentials, until Google completes app verification, clients will see a warning screen: "This app isn't verified." Many business owners will stop at this screen and not connect Gmail. This is not a bug — it is a Google policy requirement. It cannot be worked around. The verification must be completed.

**9. Concurrent tenant growth on one Node process (Low — future)**
All API requests, WorkerEngine polling, and chain execution run in one Node process. Under sustained concurrent load from many active tenants, the event loop will block. Required at scale: move the WorkerEngine to a separate process. The architecture already supports this — it is a deployment change, not a code rewrite. Monitor event loop lag before this becomes urgent.
