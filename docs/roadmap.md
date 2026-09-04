# Roadmap

## Foundation

Completed:

- Remove vendor-specific generated project dependencies.
- Establish service and repository boundaries.
- Create backend folder structure.
- Create Supabase-compatible schema.
- Define tenant, SOP, task queue, quota, and audit foundations.
- Document architecture, database, queue, and security principles.

## Execution Engine

Completed:

- QueueService task lifecycle methods.
- WorkerEngine orchestration pipeline.
- SOP loading, validation, and prompt rendering.
- ProviderRegistry and WorkerRegistry.
- Audit event emission.
- Idempotent task enqueueing.
- Dead-letter semantics.

## Persistence

Completed:

- Repository contracts.
- In-memory repository implementations for executable contract tests.
- Reusable repository contract test suite.

Next:

- Repository Factory. *(completed)*
- Supabase repository adapters. *(completed)*
- Integration tests against local Supabase. *(completed)*
- Migration validation pipeline. *(completed in this phase)*

## Infrastructure — current phase

Completed:

- Repeatable local database lint and repository integration command (`npm run db:integration`).
- Production worker runtime with graceful shutdown and lock-recovery checks.
- Production worker container/configuration (`Dockerfile.worker`, `docs/deployment.md`).
- Migration-history reconciliation gate (`npm run db:migration:check`).
- Development-only deterministic email triage trigger, tenant-authenticated and queue-backed.
- Local-only signup confirmation bypass flag; production keeps real Supabase confirmation.

Remaining verification:

- Operational telemetry and structured worker error reporting. *(completed)*
- Deployment environments and secrets management. *(completed)*
- Complete real Gmail OAuth consent for a test tenant and verify the approval/send audit trail against Gmail.

## Capabilities

In progress:

- Email capability: provider contract, mock adapter, normalized email worker, and audited queue execution. *(first slice completed)*
- CRM capability: tenant-scoped contact repository and service foundation. *(first slice completed)*
- CRM API: authenticated tenant-scoped contact list and upsert endpoints. *(first slice completed)*
- Frontend CRM API client methods for tenant-scoped contact list and upsert. *(first slice completed)*
- CRM contact interaction notes repository, API, and drawer integration *(implemented; remote migration pending)*
- CRM leads migration, tenant-scoped repository, API, and frontend integration *(implemented)*
- CRM Accounts operations and Deals project repository/API integration *(implemented)*
- Employee setup persistence, lifecycle activation, dynamic system prompts, and server-side skill-plan enforcement. *(implemented)*
- Company Brain ingestion with tenant-scoped chunk persistence and embedding-backed retrieval. *(implemented)*

Planned:
- Live Gmail OAuth verification and production credential rotation.
- Document capability.
- Scheduling capability.
- WhatsApp capability.

Capabilities should be built as combinations of workers, SOPs, providers, validation rules, and audit events rather than as isolated subsystems.

## Future AI

Planned:

- Production AI provider adapters.
- Provider failover.
- Prompt and SOP evaluation.
- Model settings per SOP.
- Output validation and repair loops.
- Human review workflows.
