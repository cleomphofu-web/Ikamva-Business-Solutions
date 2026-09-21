# Current State Snapshot

**Date produced:** 2026-09-15
**Ground rules:** Every claim is traceable to a file and line read in this session. Where behaviour is present in code but not exercised end-to-end in a running system, it is marked *untested in prod*. Where code exists but is known dead or gated off, it is marked accordingly. Speculation is replaced with "uncertain - needs verification."

---

## 1. Stack and Entry Points

| Layer | Technology | Entry point |
|---|---|---|
| Frontend | React 18, Vite, TypeScript/JSX | `src/main.jsx` -> `src/App.jsx` |
| Backend API | Node.js, bare `node:http`, no Express | `backend/dev-server.js` (dev); `backend/workers/worker-process.js` (worker) |
| Database | Supabase (Postgres + Auth + RLS) | `backend/lib/supabase-admin.js` |
| AI providers | Groq (default), OpenAI, mock | Selected at startup in `createExecutionContainer.js` |
| Email delivery | Resend via `HttpEmailProvider`, or `MockEmailProvider` | Registered if `EMAIL_PROVIDER_API_KEY` + `EMAIL_FROM` env vars present |

The backend runs as two independent processes in production: the **API process** (HTTP server; Vite dev plugin in development) and the **Worker process** (`worker-process.js`). In development both are served through Vite`s `configureServer` hook which calls `createApiRouter()`.

Repository provider is selected by the `REPOSITORY_PROVIDER` env var (`memory` or `supabase`). When `supabase` is selected, a `supabaseAdmin` client is passed into `createExecutionContainer`. When `memory` is selected, all repositories are in-process `InMemory*` classes.

---

## 2. Backend Service Topology

### 2.1 Dependency Injection

All backend singletons are wired in `backend/container/createExecutionContainer.js`. Two factory functions exist:

- `createExecutionContainer()` - root container: provider registry, worker registry, repository factory, embedding service, Gmail message service.
- `createTenantExecutionContainer({ tenantId, rootContainer })` - tenant-scoped container: scoped repositories, audit service, queue service, task chain service, SOP service, quota service, worker engine.

There is **one worker engine per tenant** in the worker process. The root container is shared across tenants for cross-cutting singletons (provider registry, embedding service).

### 2.2 Registered Workers

All registrations are in `createExecutionContainer.js` lines 83-101.

| Task type | Worker class | Default provider |
|---|---|---|
| `chat` | `BaseWorker` | `groq` / `openai` / `mock` (env) |
| `job` | `BaseWorker` | same |
| `email_triage` | `EmailTriageWorker` | `groq` |
| `email_response` | `EmailResponseWorker` | `groq` |
| `email` | `EmailWorker` | `gmail-mcp`, `http-email`, or `mock-email` (env) |
| `email_read` | `ChainStepWorker` | `mock` |
| `crm_lookup` | `ChainStepWorker` | `mock` |
| `crm_update` | `ChainStepWorker` | `mock` |
| `quote_generate` | `ChainStepWorker` | `groq` |
| `support_response` | `ChainStepWorker` | `groq` |
| `lead_capture` | `ChainStepWorker` | `mock` |
| `email_draft` | `ChainStepWorker` | `gmail-mcp` |
| `approval_gate` | `ChainStepWorker` | `http-email` |
| `email_send` | `ChainStepWorker` | `gmail-mcp` |

`shift_start` is enqueued by the worker process scheduler (`worker-process.js` line 80) but is **not registered** in the worker registry. A task of type `shift_start` would hit the `NotFoundError` path in `WorkerEngine.processTask`. This is a latent bug.

### 2.3 AI Providers Registered

| Key | Class | Condition |
|---|---|---|
| `mock` | `MockAIProvider` | Always |
| `openai` | `OpenAIProvider` | `OPENAI_API_KEY` or `GEMINI_API_KEY` or `AI_provider_chatGPT_API` present |
| `groq` | `GroqProvider` | `GROQ_API_KEY` present; model defaults to `openai/gpt-oss-20b` |
| `gmail-mcp` | `GmailMCPProvider` | Always (OAuth disabled by default) |
| `mock-email` | `MockEmailProvider` | Always |
| `http-email` | `HttpEmailProvider` | `EMAIL_PROVIDER_API_KEY` + `EMAIL_FROM` present |

---

## 3. Runtime Pipeline

### 3.1 Task Lifecycle

```
POST /api/v1/workforce/tasks  (or /chat)
  -> handleTaskSubmit (workforce.js)
  -> QueueService.enqueueTask
     -> idempotency check (findByIdempotencyKey)
     -> TaskQueueRepository.create
     -> AuditService.emit(TASK_CREATED)

WorkerRuntime.tick()  [every pollIntervalMs, default 1000ms]
  -> recoverExpiredLocks (once per tick cycle, guarded by in-flight flag)
  -> chainService.recoverStalledChains
  -> WorkerEngine.processNext
     -> QueueService.claimNextTask
        -> TaskQueueRepository.claimNext (atomic; FOR UPDATE SKIP LOCKED in Supabase impl)
     -> WorkerEngine.processTask(task)
```

### 3.2 processTask Stages

All stages emit audit events to `task_logs` via `AuditService`.

1. **VALIDATION_STARTED** - worker looked up from registry; SOP loaded (or synthetic chain SOP if `parent_task_id` present and real SOP not found).
2. **SOP validation** - `sopService.validateInput` checks required payload fields against `validation_schema.required`.
3. **VALIDATION_COMPLETED** - quota check via `QuotaService.ensureWithinQuota`.
4. **Skill/plan gate** - checks `requiredSkillForTask`, `planIncludesSkill`, and `enabledSkills` on the employee record. Bypassed in test mode (`NODE_ENV=test` or `MOCK_GMAIL=true`).
5. **QUOTA_APPROVED** - prompt assembly: audience resolved, `buildStoredEmployeePrompt` called (throws if audience missing or invalid).
6. **Context injection** - `assembleContextPrompt`: memory recall, company knowledge RAG (embedding or keyword search), and for `account_owner` audience, live DB grounding for specialists, recent tasks, and pending approvals.
7. **Action policy** - `assessAction` against `autonomy_mode` (`approve` / `observe` / `auto`). Blocked actions throw `ActionPolicyError`; observed actions return immediately without AI call; approval-mode sets `requires_approval = true`.
8. **AI_REQUESTED** - provider `worker.execute(...)` with retry (up to 3 attempts for `ProviderError`).
9. **Confidence parse** - `parseConfidence` strips `[CONFIDENCE:N]` token. Score < 50: task parked as `awaiting_approval`; approval row written; notification email sent.
10. **AI_COMPLETED + RESULT_VALIDATED** - quota incremented, task completed, activity log written, memory written.
11. **Chain advance** - if `parent_task_id` set and `taskChainService` present, `advanceChain` enqueues the next step.

### 3.3 Audience Resolution

Resolved at `WorkerEngine.js` line 137:

```js
const audience = task.task_type === 'chat' ? 'account_owner'
  : (task.parent_task_id ? 'system' : 'end_customer');
```

`EmployeePromptService.buildStoredEmployeePrompt` enforces one of `account_owner`, `end_customer`, or `system`; throws on anything else. This prevents the "You are a customer" class of bug unconditionally.

---

## 4. Manager and Specialist Architecture

### 4.1 Audience Modes

| Audience | When set | Prompt behaviour |
|---|---|---|
| `account_owner` | `task_type === 'chat'` | Manager mode: internal ops, team status, config. Schedule gate skipped. |
| `end_customer` | Non-chat, no `parent_task_id` | Customer voice: no internal details. OOO block injected when outside shift. |
| `system` | Any task with `parent_task_id` | Specialist executor: scoped capability prompt. |

### 4.2 Manager Live Grounding

Injected in `assembleContextPrompt` (`WorkerEngine.js` lines 458-505) when `audience === 'account_owner'`:

- **Keyword "team / specialist / status"** - queries `specialistRepository.listByEmployee` and appends real enabled/disabled rows to prompt.
- **Keyword "activity / log / recent"** - queries `taskQueueRepository.listRecent(20)`. Note: `this.taskQueueRepository` is not in the `WorkerEngine` constructor and is `undefined`. The try/catch silently swallows this. Activity grounding is currently broken (see Section 10).
- **Keyword "approval / pending / review"** - queries `approvalRepository.list(tenantId)` filtered by `status === 'pending'`. This path works; `approvalRepository` is injected.

### 4.3 Specialist Registry

Five specialists seeded per employee by `InMemorySpecialistRepository.seedDefaults` and Supabase migration `202609110001_ai_employee_specialists.sql`:

| Type | Default enabled | Notes |
|---|---|---|
| `sales` | true | Handles `quote_request` email category |
| `support` | true | Handles `customer_support` and drafting/approval/send steps |
| `crm` | Conditional | `true` only if a CRM integration is connected at seed time |
| `lead_capture` | false | Handles `lead` email category |
| `data_analysis` | false | `config.status = 'not_yet_available'`; UI shows "Coming soon" |

`specialist_id` is written to `task_queue` rows when `TaskChainService.createChain` resolves a specialist. The same column is added to `approval_queue` by the migration.

### 4.4 Disabled Specialist Path

When `EmailTriageWorker` classifies an email and the mapped specialist is disabled, it calls the holding reply path. When `TaskChainService.createChain` detects `specialist.enabled === false`, it:

1. Enqueues an `email_response` task with a canned holding message.
2. Writes a `disabled_specialist_attempt` log row via `taskLogRepository`.
3. Returns `{ status: 'holding_reply_sent', specialistType }` without creating a chain.

---

## 5. IPC and Task Chaining

### 5.1 Chain Structure

A chain is two layers of `task_queue` rows:

- **Parent row** - `task_type: 'task_chain'`, holds `chain_config` (steps array), `step_index: -1`.
- **Child rows** - one per step, each with `parent_task_id`, `step_index`, `step_name`, `specialist_id`.

Context propagates forward through `chain_context` inside `payload`. Each `ChainStepWorker` reads `payload.chain_context`, does its work, and returns a result. `WorkerEngine` line 326 calls `taskChainService.advanceChain(task.parent_task_id, result.output.chain_context || result.output)`. `advanceChain` merges prior context with the step result and enqueues the next child task.

### 5.2 Live Activity

`TaskChainService.updateActivity` upserts a `chain_activity` row via `TaskChainStateRepository` (Supabase only; null-safe - silently skipped without Supabase). Step labels: `email_read` "Reading email", `crm_lookup` "Appending CRM", `quote_generate` "Generating quote", `email_draft` "Creating Gmail draft", `approval_gate` "Waiting for approval", `email_send` "Sending email".

### 5.3 Recovery

`WorkerRuntime.tick` calls `recoverExpiredLocks` on every tick cycle. It also calls `chainService.recoverStalledChains`, which finds parent chains older than 30 minutes not in a terminal state and marks the employee `lifecycle_status = 'needs_attention'`.

---

## 6. API Surface

All routes under `/api/v1/` registered in `backend/api/router.js`.

| Path | Method | Handler |
|---|---|---|
| `/api/v1/workforce/tasks` | GET | task list |
| `/api/v1/workforce/tasks` | POST | submit task |
| `/api/v1/workforce/chat` | POST | same as task submit |
| `/api/v1/workforce/chat/history` | GET | chat history |
| `/api/v1/workforce/chat/:id/status` | GET | task status |
| `/api/v1/workforce/tasks/:id` | PATCH | update task |
| `/api/v1/workforce/employees` | GET/POST/PATCH | employee CRUD |
| `/api/v1/workforce/employees/parse-intent` | POST | intent parsing |
| `/api/v1/workforce/specialists` | GET/PATCH | specialist list and toggle |
| `/api/v1/workforce/knowledge` | GET | knowledge list |
| `/api/v1/workforce/knowledge/ingest` | POST | ingest knowledge |
| `/api/v1/workforce/activity-logs` | GET | activity logs |
| `/api/v1/workforce/approvals` | GET/PATCH/POST | approval queue |
| `/api/v1/workforce/integrations` | GET | integration status |
| `/api/v1/workforce/chains` | GET | chain list |
| `/api/v1/workforce/chains/:id` | GET | chain status |
| `/api/v1/integrations/status` | GET | Gmail integration |
| `/api/v1/integrations/gmail/*` | * | Gmail OAuth |
| `/api/v1/access` | GET | access check |
| `/api/v1/applications` | GET/POST/PATCH | applications |
| `/api/v1/crm/contacts` | GET/POST/PATCH/DELETE | CRM contacts |
| `/api/v1/crm/leads` | GET/POST/PATCH/DELETE | CRM leads |
| `/api/v1/crm/accounts/summary` | GET | account summary |
| `/api/v1/crm/projects` | GET/POST/PATCH/DELETE | projects |
| `/api/v1/dev/*` | * | dev utilities |
| `/api/v1/webhooks/*` | * | webhooks |

No route exists for `GET /api/v1/workforce/tasks/:id` or task log retrieval (noted as future in `router.js` line 106).

---

## 7. Frontend Pages

| Route | Component | Notes |
|---|---|---|
| `/` | `Home.jsx` | Landing |
| `/services` | `Services.jsx` | |
| `/contact` | `Contact.jsx` | |
| `/sign-in` | `SignIn.jsx` | |
| `/sign-up` | `SignUp.jsx` | |
| `/dashboard/overview` | `MissionControl/Overview.tsx` | |
| `/dashboard/onboarding` | `MissionControl/onboarding.tsx` | 36 KB - largest single component |
| `/dashboard/team` | `MissionControl/team.tsx` | Specialist enable/disable UI |
| `/dashboard/approvals` | `MissionControl/approvals.tsx` | Pending approval queue |
| `/dashboard/skills` | `MissionControl/skills.tsx` | |
| `/dashboard/schedule` | `MissionControl/schedule.tsx` | |
| `/dashboard/logs` | `MissionControl/logs.tsx` | |
| `/dashboard/tools` | `MissionControl/tools.tsx` | |
| `/dashboard/rules` | `MissionControl/rules.tsx` | |
| `/dashboard/hours` | `MissionControl/hours.tsx` | |
| `/dashboard/tokens` | `MissionControl/tokens.tsx` | |
| `/dashboard/account` | `MissionControl/account.tsx` | |
| `/admin/*` | `src/pages/admin/` | Admin-only |

Frontend uses polling (setInterval / React hooks). There is no WebSocket or SSE push channel.

---

## 8. Database Schema

33 migrations applied. Key tables:

| Table | Purpose |
|---|---|
| `tenants` | Tenant records, plan, quota windows |
| `tenant_users` | Membership; drives RLS on all tables |
| `ai_employees` | One per tenant; lifecycle_status, autonomy_mode, schedule, configuration |
| `ai_employee_memory` | Per-employee memory with thread_id support |
| `ai_employee_specialists` | 5 capability rows per employee; enabled flag |
| `task_queue` | Central work queue; specialist_id column |
| `task_logs` | Audit trail for every status transition |
| `sops` | System prompt + validation schema per task_type per tenant |
| `approval_queue` | Approval requests; confidence_score, action_payload columns |
| `crm_contacts` | Tenant-scoped contacts |
| `crm_leads` | Inbound leads |
| `company_knowledge` | Ingested chunks + pgvector embeddings |
| `tenant_integrations` | OAuth records (Gmail, etc.) |
| `applications` | Client application intake |
| `notifications` | In-app notifications |
| `chain_activity` | Live chain step progress |

RLS is enabled on all tables and enforced through `tenant_users` membership.

---

## 9. Test Coverage

28 test files under `backend/tests/`. Selected suites:

| File | Coverage |
|---|---|
| `manager-specialists.test.js` | Audience enforcement, grounding queries (including active activity grounding), specialist toggle |
| `task-chain.test.js` | Chain creation, specialist attribution, holding reply, disabled-specialist routing |
| `in-memory.queue.contract.test.js` | Queue repository contract: claim, complete, retry, dead-letter |
| `supabase-adapter-contract.test.js` | Supabase adapter against same contract |
| `gmail-dispatch-dryrun.test.js` | Full triage to chain to approval flow in mock mode |
| `gmail-approval-audit.test.js` | Approval queue write + confidence annotation |
| `worker-runtime.test.js` | WorkerRuntime tick, recovery, shutdown |
| `confidence.test.js` | Confidence score parsing |
| `action-risk.test.js` | Action policy assessment |
| `api-authorization.test.js` | Route auth enforcement |

Last confirmed pass count: 82/82. Verify with `npm test`.

---

## 10. Known Gaps

| Gap | Evidence |
|---|---|
| `data_analysis` specialist is a placeholder | Seeded as `enabled: false`, `status: 'not_yet_available'`; no `ChainStepWorker` branch handles it |
| `GET /api/v1/workforce/tasks/:id` route missing | Noted as future in `router.js` line 106 |
| Email triage idempotency window edge case | Key suffix uses `Math.floor(Date.now() / 300000)`; a worker restart mid-window re-enqueues immediately |
| Webhook signature verification status | Uncertain - `webhooks.js` contents not read in this session |
| No real-time push | Frontend polls; no WebSocket or SSE |

---

## 11. Diff Against Prior Design Docs

Items specified in `RUNTIME_ARCHITECTURE.md` that are now implemented:

- Audience-gated prompt assembly (account_owner / end_customer / system)
- Specialist table and 5-type provisioning
- `specialist_id` on task queue and approval queue rows
- Disabled specialist to holding reply to `disabled_specialist_attempt` log
- Chain context propagation via `chain_context` in payload
- Live chain activity upsert and `AgentActivityTicker` mounted on dashboard overview
- Stalled chain recovery in `WorkerRuntime`
- Manager grounding for team status, approvals, and recent task activity
- `shift_start` task execution registered and handled as system-scoped task

Items specified but not yet verified working end-to-end in a deployed environment:

- Full email triage to quote chain to Gmail draft to approval to send (exercised in test with mocks; untested against live Gmail)
- Webhook token validation (migration `202609090003_webhook_tokens.sql` exists; handler behaviour uncertain)

