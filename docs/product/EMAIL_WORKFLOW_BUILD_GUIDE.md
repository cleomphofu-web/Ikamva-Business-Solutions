# Email Management Workflow — Full Build Guide

Built on the existing Manager + Specialists architecture (`WorkerEngine`,
`TaskChainService`, `EmailTriageWorker`, `ai_employee_specialists`, `approval_queue`,
`company_knowledge`). Nothing here replaces that — it extends the `support` and `sales`
specialists into a fully autonomous, schedulable, quota-metered workflow, and formalizes
how new tools get added without a rebuild each time.

## 0. Design Principle — Adapter Interface Now, One Proven Integration First

Every tool the Employee touches — email, CRM, documents, file storage, spreadsheets —
gets accessed through a narrow interface, not a direct SDK call scattered through worker
code. Five core interfaces:

```typescript
export interface EmailProvider {
  listUnread(options?: { since?: string; maxResults?: number; credentialReference?: string }): Promise<EmailSummary[]>;
  getThread(threadId: string, options?: { credentialReference?: string }): Promise<EmailThread>;
  createDraft(to: string, subject: string, body: string, attachments?: Attachment[], options?: { credentialReference?: string }): Promise<Draft>;
  send(draftId: string, options?: { credentialReference?: string }): Promise<SendResult>;
}

export interface CRMProvider {
  findContact(email: string): Promise<Contact | null>;
  upsertContact(data: ContactInput): Promise<Contact>;
  updateDeal(dealId: string, fields: Record<string, any>): Promise<void>;
}

export interface DocumentGenerator {
  generate(templateId: string, data: Record<string, any>): Promise<{ fileUrl: string; mimeType: string }>;
}

export interface FileStorageProvider {
  upload(path: string, content: Buffer, mimeType: string): Promise<{ url: string }>;
  download(path: string): Promise<Buffer>;
}

export interface SpreadsheetProvider {
  readRange(fileId: string, range: string): Promise<any[][]>;
  writeRange(fileId: string, range: string, values: any[][]): Promise<void>;
}
```

**Implementation sequence:**
1. `EmailProvider` for Gmail (`GmailMCPProvider`/`GmailMessageService`) — verified end-to-end first.
2. `CRMProvider` for HubSpot / internal CRM.
3. `DocumentGenerator` (HTML/CSS + PDF template renderer).
4. `FileStorageProvider` (Supabase Storage / local bucket).
5. `SpreadsheetProvider`.

---

## 1. Setup Assistance — Manager Proactively Offers, Never Handles Secrets

Extend the Manager's dashboard-chat behavior (grounded via `get_team_status` etc.)
with integration status checks against `tenant_integrations`:
- When a required tool in `job_spec.tools_required` is not connected, the Manager proactively raises it.
- OAuth redirect links for OAuth tools (server-side exchange only).
- Direct settings URL links for API keys (never sent to LLM prompt).
- Offers one-click start command upon spec completion.

---

## 2. Job Specification — How Description Becomes Config

The client's description is compiled into `ai_employees.configuration.job_spec`:

```json
{
  "tools_required": ["gmail", "hubspot"],
  "capabilities": ["read_respond_email", "crm_update", "send_quotes"],
  "conditional_rules": [
    { "when": "category == 'new_lead'", "then": "crm_upsert_contact" },
    { "when": "category == 'quote_request'", "then": "generate_quote_document" }
  ],
  "knowledge_sources": ["faq.pdf", "pricing_sheet.xlsx"],
  "document_templates": [{ "type": "quote", "template_id": "tpl_quote_v1" }],
  "schedule": { "days": ["mon","tue","wed","thu","fri"], "start": "09:00", "end": "17:00", "timezone": "Africa/Johannesburg" },
  "task_quota": { "pack_size": 100, "auto_pause_on_exhaustion": true }
}
```

---

## 3. Continuous Operation Within Scheduled Hours

- **At `schedule.start`:** The `shift_start` task fires, executing morning briefing and setting up mail listeners/polling.
- **Within window:** `WorkerRuntime.tick()` processes queued triage and chain steps continuously.
- **At `schedule.end`:** Stop pulling new work, allow in-flight tasks to complete, outside-shift messages trigger OOO holding replies computed in code.
- **At next `schedule.start`:** Resume automatically.

---

## 4. Task-Based Quota — Pause at N, Prompt to Buy More

- **Billable Task Definition:** One fully completed customer interaction (a completed chain or direct response), not internal sub-steps.
- Track usage against `job_spec.task_quota.pack_size`.
- When quota is exhausted: Transition employee to `lifecycle_status: 'needs_attention'` with reason `quota_exhausted`.
- Auto-resume upon webhook receipt of payment pack.

---

## 5. Reading and Responding — RAG Grounding

- Ingest documents listed in `job_spec.knowledge_sources` into `company_knowledge`.
- Retrieve top-k chunks on inbound emails.
- If retrieval has low confidence/empty match for company-specific facts, hold task for human review rather than hallucinating.

---

## 6. Conditional CRM Update

- Evaluated in application code against `job_spec.conditional_rules`.
- Matching rules enqueue `crm_update` child tasks in the active chain.

---

## 7. Quotes and Invoices from Company Templates

- HTML + CSS templates stored in tenant-scoped storage.
- `DocumentGenerator.generate(templateId, data)` renders to PDF.
- Output attached to `email_draft` before human approval gate.

---

## 8. Pause, Report, and Bookmark

- **Pause on Trouble:** Unrecoverable error sets chain to `needs_attention` with distinct reason code (`tool_error`, `ambiguous_request`, `low_confidence`).
- **Bookmark and Skip:** `bookmarked` status for tasks needing client clarification without stalling the specialist queue.
- **Report on Request:** Manager surfaces activity, approvals, bookmarks, and quota counters.
