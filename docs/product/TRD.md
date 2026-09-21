# Ikamva — Technical Requirements Document
**Version:** 2.0 | **Status:** Active

---

## 1. Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + Vite + React Router v6 | Existing, well-tested |
| Styling | Tailwind CSS + shadcn/ui + Radix | Existing component library |
| Animation | Framer Motion | Existing |
| Auth | Supabase Auth | JWT, email confirmation, OAuth |
| Database | Supabase PostgreSQL | Relational + RLS + Realtime + pgvector |
| Backend | Node.js + Express | Existing, all API routes here |
| Queue | PostgreSQL task_queue table | Sufficient for current scale |
| AI Provider | Groq (dev) / OpenAI (prod) | Env-var switchable |
| Embeddings | OpenAI text-embedding-3-small | Separate key from chat |
| Email delivery | Resend via HttpEmailProvider | Approval notifications |
| File storage | Supabase Storage | Document uploads |
| Token encryption | AES-256-GCM | Gmail OAuth tokens |
| Deployment | Docker + any VPS | docker-compose for local |

---

## 2. Non-Negotiable Technical Constraints

1. **Every irreversible action requires an approval record** — no exceptions, not even in development. `gmail.send` without an `approval_decisions` row is a bug.
2. **Tenant isolation is enforced at the database layer** — RLS policies on every table that contains tenant data. Application-level `WHERE tenant_id =` is insufficient alone.
3. **No secrets in frontend code** — API keys, OAuth tokens, encryption keys are server-side only. The browser never receives a raw token.
4. **Provider API keys are env vars** — never in source code, never in logs.
5. **Every task type must pass entitlement checks before execution** — plan limit and skill-disabled checks happen in the WorkerEngine before any provider call.

---

## 3. Authentication & Authorisation

### Auth flow
- Supabase Auth handles email/password and Google OAuth sign-in
- On sign-in, frontend extracts `session.access_token` directly from the `signInWithPassword()` response — never from a separate `getSession()` call
- Backend validates the JWT on every request via `supabase.auth.getUser(token)`
- `tenant_id` is always read from the validated JWT claims, never from the request body

### Roles
- `client` — can access their own tenant's data, submit approvals, chat with their Employee
- `admin` — can access all tenant data, approve/reject applications, manage platform
- `platform_admin` — same as admin plus billing management

### RLS pattern (applied to every table)
```sql
create policy {table}_tenant_access on public.{table}
  for all using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'platform_admin')
    or exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = {table}.tenant_id
      and tu.user_id = auth.uid()
      and tu.status = 'active'
    )
  );
```

---

## 4. API Design

### Base URL
`/api/v1/`

### Standard response envelope
```json
// Success
{ "data": { ... } }

// Error
{ "error": { "code": "PLAN_LIMIT", "message": "...", "details": { ... } } }
```

### Typed error codes
| Code | HTTP | Meaning |
|---|---|---|
| UNAUTHORIZED | 401 | No valid JWT |
| FORBIDDEN | 403 | Valid JWT, insufficient permission |
| NOT_FOUND | 404 | Resource does not exist |
| VALIDATION_ERROR | 422 | Request body invalid |
| PLAN_LIMIT | 402 | Skill not in tenant's plan |
| SKILL_DISABLED | 403 | Skill toggled off by client |
| INTEGRATION_ERROR | 502 | OAuth token expired/revoked |
| PROVIDER_ERROR | 502 | AI provider call failed |
| INTERNAL_ERROR | 500 | Unexpected failure |

### Route groups
```
/api/v1/auth/          — sign-in, sign-up, access check
/api/v1/workforce/     — employees, chat, chains, approvals
/api/v1/integrations/  — Gmail OAuth, status, disconnect
/api/v1/knowledge/     — document ingest, knowledge base
/api/v1/crm/           — contacts, leads, accounts
/api/v1/admin/         — applications, subscribers, platform stats
/api/v1/webhooks/      — inbound webhook triggers
/api/v1/dev/           — development-only test endpoints (404 in production)
```

---

## 5. Worker Architecture

### Queue lifecycle
```
pending → processing → completed
                    ↘ failed (retries exhausted)
                    ↘ awaiting_human (approval required)
```

### WorkerEngine responsibilities
1. Poll `task_queue` for `pending` tasks every 2 seconds
2. Lock the task (set `locked_at`, `locked_by`)
3. Check entitlement: plan limit and skill enabled
4. Load Employee configuration and system prompt
5. Assemble context: system prompt + memory + Company Brain chunks
6. Execute the task type handler
7. On success: advance chain, write activity log, write memory
8. On failure: retry with exponential backoff (provider errors only), then fail chain

### Task types
| Type | Handler | Approval required |
|---|---|---|
| `chat` | ChatWorker | No |
| `email_triage` | EmailTriageWorker | No |
| `email_response` | EmailResponseWorker | Yes (before send) |
| `email_read` | chain step | No |
| `crm_lookup` | chain step | No |
| `quote_generate` | chain step | No |
| `email_draft` | chain step | No |
| `approval_gate` | chain step | Yes |
| `email_send` | chain step | Triggered by approval |

### Startup recovery
On WorkerEngine startup: find tasks where `status = 'processing'` and `locked_at < NOW() - interval '5 minutes'`. Reset to `pending` or fail if retries exhausted. Write `TASK_RECOVERED` log entry.

---

## 6. AI Provider Integration

### Provider interface
Every provider must implement:
```js
{
  chat(systemPrompt, messages, options) → { content, usage }
  embed(text) → Float32Array[1536]
}
```

### Context assembly order (every chat/response task)
1. Stored Employee system prompt from `ai_employees.configuration.system_prompt`
2. Schedule check — if outside hours, prepend out-of-hours notice
3. Last 20 memory rows for this employee, filtered by thread_id if present
4. Top 3 Company Brain chunks matched by cosine similarity to the input
5. Assembled prompt logged to `task_logs.metadata.system_prompt` on every call

### Token refresh for OAuth
Before every Gmail API call: check if `access_token_expires_at < NOW() + 5 minutes`. If so, call `https://oauth2.googleapis.com/token` with the refresh token. Store new access token and expiry. If refresh fails, set `tenant_integrations.status = 'disconnected'` and throw `IntegrationError`.

---

## 7. Security Requirements

- AES-256-GCM for all OAuth refresh token storage — key from `ENCRYPTION_KEY` env var (32-byte base64)
- No raw tokens in logs, error messages, or API responses
- `gmail.send` always requires an `approval_decisions` row — enforced in WorkerEngine, not just UI
- Admin routes require `role = 'admin' OR 'platform_admin'` in JWT app_metadata — checked server-side
- Dev endpoints return 404 when `NODE_ENV !== 'development'`
- Webhook endpoints authenticated by `tenant_webhook_token` — a 32-byte random URL-safe token per tenant
- Rate limiting: per-tenant AI call counter in `tenant_usage_windows` — enforced before provider call

---

## 8. Email & Notification Delivery

- Approval notifications: Resend via `HttpEmailProvider`
- Contains: who emailed, AI draft preview, direct link to `/dashboard/approvals`
- On approval: Gmail draft sent via Gmail API using stored draft_id
- On rejection: Gmail draft deleted using draft_id
- Memory row written in both cases with `thread_id`

---

## 9. File Upload & Document Processing

- Files uploaded to Supabase Storage under `/{tenant_id}/knowledge/`
- Accepted: PDF, DOCX, TXT, CSV (max 10MB per file)
- On upload: extract text, chunk into ~500-word segments, generate embedding per chunk, store in `company_knowledge`
- Embedding model: `text-embedding-3-small` via OpenAI (`OPENAI_EMBEDDING_KEY` env var separate from chat key)
- Retrieval: cosine similarity via `match_company_knowledge` Postgres function — top 3 chunks per query

---

## 10. Environment Variables (required)

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# AI providers
GROQ_API_KEY=
OPENAI_API_KEY=         # optional — for production chat
OPENAI_EMBEDDING_KEY=  # for embeddings always
AI_PROVIDER=groq        # or 'openai'

# Gmail OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Security
ENCRYPTION_KEY=         # 32-byte base64 for token encryption
JWT_SECRET=             # Express session signing

# Email delivery
RESEND_API_KEY=

# Development
SKIP_EMAIL_CONFIRMATION=true  # local only, never commit
NODE_ENV=development

# Server
PORT=4178
FRONTEND_URL=http://localhost:5178
```
