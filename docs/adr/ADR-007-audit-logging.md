# ADR-007 Audit Logging

## Status

Accepted

## Context

Ikamva must explain what happened during task execution. This is required for debugging, governance, client trust, and future compliance.

## Decision

Every task transition emits an audit event. QueueService and WorkerEngine emit events automatically. Task logs are immutable.

## Consequences

- Task history is reliable and inspectable.
- Workers do not manually invent logging behavior.
- Audit volume will grow and may require retention policies later.
- Operational dashboards can be built from audit events.

## Alternatives Considered

- Manual logging inside workers: rejected because it is inconsistent.
- Provider-only logs: rejected because provider logs do not describe Ikamva business state.
