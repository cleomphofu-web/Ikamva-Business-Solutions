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

- Repository Factory.
- Supabase repository adapters.
- Integration tests against local Supabase.
- Migration validation pipeline.

## Infrastructure

Planned:

- Worker runtime.
- Queue claiming and lock recovery.
- Operational telemetry.
- Error reporting.
- Deployment environments.
- Secrets management.

## Capabilities

Planned:

- Email capability.
- CRM capability.
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
