# Ikamva — Architecture
**Version:** 2.0

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                        │
│  React + Vite + Tailwind + shadcn/ui + Framer Motion        │
│                                                              │
│  Landing → Signup → Apply → Setup → Dashboard               │
│  Mission Control: Chat | Approvals | Logs | Chain Ticker     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           │ JWT in Authorization header
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     EXPRESS API SERVER                       │
│                    Node.js — port 4178                       │
│                                                              │
│  /api/v1/auth        /api/v1/workforce   /api/v1/crm        │
│  /api/v1/integrations /api/v1/knowledge  /api/v1/admin      │
│  /api/v1/webhooks    /api/v1/dev                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ AuthService  │  │EmployeeService│  │TaskChainService  │  │
│  │ QuotaService │  │ QueueService  │  │ApprovalService   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  RepositoryFactory.forTenant(tenantId)                      │
│  → SupabaseRepositoryProvider                               │
│    → [Employee|Task|Approval|Memory|Knowledge|...]Repo      │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴──────────────┐
              │                           │
              ▼                           ▼
┌─────────────────────┐      ┌────────────────────────────┐
│   WORKER ENGINE      │      │        SUPABASE             │
│   (same process)     │      │                            │
│                      │      │  PostgreSQL + RLS          │
│  Poll task_queue     │      │  Auth (JWT)                │
│  every 2 seconds     │◄────►│  Storage (documents)       │
│                      │      │  Realtime (task_chains)    │
│  Workers:            │      │  pgvector (embeddings)     │
│  - ChatWorker        │      └────────────────────────────┘
│  - EmailTriageWorker │
│  - EmailResponseWorker│              │
│  - Chain step workers │              │ Realtime websocket
│                      │              ▼
│  ProviderRegistry    │      ┌──────────────────┐
│  → GroqProvider      │      │  CLIENT BROWSER  │
│  → OpenAIProvider    │      │  Chain ticker    │
└──────────────────────┘      │  updates live    │
              │               └──────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
    ▼                    ▼
┌──────────┐      ┌──────────────┐
│  GROQ /  │      │  GMAIL API   │
│  OPENAI  │      │  Google OAuth│
│  API     │      │  token refresh│
└──────────┘      └──────────────┘
              │
              ▼
       ┌────────────┐
       │   RESEND   │
       │ (approval  │
       │ emails)    │
       └────────────┘
```

---

## Architectural Decisions

### Why PostgreSQL queue, not Redis/SQS
At Ikamva's scale (hundreds of tasks per hour, not millions), a Postgres-based queue is correct. It gives us: transactional task creation (task and log written atomically), RLS-based tenant isolation for free, no additional infrastructure to manage, and direct queryability for debugging. We revisit this decision at 10,000 tasks/hour sustained load with evidence.

### Why one Express process, not microservices
The WorkerEngine, API server, and business logic run in one Node process. This is intentional. Microservices introduce distributed system complexity (network partitions, service discovery, distributed tracing) that is not justified by current scale. The architecture is modular — services are cleanly separated — so extraction to separate processes is possible when evidence demands it.

### Why Supabase RLS over application-layer isolation
Tenant isolation enforced only in application code is broken the moment someone makes a query without the `WHERE tenant_id =` clause — a one-line mistake that leaks all tenant data. RLS enforced at the database layer means that mistake is impossible. The tenant filter cannot be forgotten. This is a security requirement, not a preference.

### Why approval gate is mandatory for all write actions
The entire product promise is "the AI does the work, you approve the important decisions." An AI that can send emails without human approval is a liability, not a feature. The approval gate is not a technical constraint — it is the product's core safety contract. Removing it for "convenience" would break trust with every client.

### Why one AI Employee per tenant (initially)
Multi-employee per tenant adds configuration complexity, routing logic (which employee handles which email?), and billing complexity. Starting with one Employee per tenant lets us validate the core value proposition cleanly before introducing that complexity. Business plan allows 3 Employees — the schema and WorkerEngine support it already, the UX just exposes one for Starter/Professional.

---

## Component Boundaries

### What goes in the API layer
- Request validation
- Authentication (JWT check)
- Authorisation (role + plan check)
- Response serialisation
- Rate limiting headers
- Error envelope formatting

### What goes in the service layer
- Business rules
- Cross-repository orchestration
- External API coordination
- Notification dispatch

### What goes in the repository layer
- Database queries only
- Tenant scoping
- No business logic
- No external calls

### What goes in the WorkerEngine
- Task lifecycle management
- Entitlement enforcement
- Context assembly
- Provider call orchestration
- Chain advancement
- Memory and audit log writes

### What stays in the database
- Referential integrity
- Uniqueness constraints
- RLS policies
- Immutable audit records (task_logs are append-only)

---

## Dependency Flow (enforced, not aspirational)

```
Browser → API Routes → Services → Repositories → Database
                    ↘ WorkerEngine → Providers → External APIs
```

Rules:
- Repositories never call services
- Services never import route handlers
- WorkerEngine never imports route handlers
- Providers never import repositories directly
- No circular imports

---

## Scalability Path

Current: single Node process, Postgres queue, single Supabase project.

When to add what:
- **5,000 tasks/hour sustained**: move WorkerEngine to a separate process/container. API and Worker are already logically separate — this is a deployment change, not an architecture change.
- **50,000 tasks/hour**: consider pg-boss or BullMQ for queue management. The task_queue schema is compatible.
- **Multiple regions**: Supabase supports read replicas. Workers read from replica, writes go to primary.
- **Redis**: only when Postgres queue becomes a measurable bottleneck (latency > 500ms p95 on task pickup). Not before.

---

## Architecture Essentials

These are the five things that, if broken, break the entire product.

### Essential 1 — Tenant isolation
Every query that touches tenant data must be scoped. The RLS policy is the enforcement layer. The `RepositoryFactory.forTenant(tenantId)` pattern is the application-layer reminder. Both must be present. Either alone is insufficient.

### Essential 2 — Approval gate integrity
The `approval_queue` record must exist and be in `approved` status before any `email_send` step executes. This is checked in the WorkerEngine chain step handler, not in the route. Routes can be bypassed — the WorkerEngine cannot.

### Essential 3 — Idempotent task creation
Every task has an `idempotency_key`. Duplicate email triage from polling the same Gmail message twice must produce one task, not two. The unique constraint on `idempotency_key` is the database guarantee. The application constructs the key as `{task_type}_{source_id}`.

### Essential 4 — Token encryption at rest
Gmail refresh tokens are never stored in plaintext. The `ENCRYPTION_KEY` env var must be present for the backend to start. If it is missing or changed, decryption fails and all Gmail integrations go to `disconnected` status — a recoverable failure, not a data leak.

### Essential 5 — Append-only audit trail
`task_logs` rows are never updated or deleted. Every state transition in every task is recorded. This is the source of truth for debugging, compliance, and client trust. If a client disputes what their Employee did, the `task_logs` table is the answer.
