# ADR-003 Queue Semantics

## Status

Accepted

## Context

Ikamva workers must safely process tasks even when retries, timeouts, duplicate submissions, and worker failures occur.

## Decision

Queue semantics are at-least-once. Every task submission must include an idempotency key. QueueService owns enqueue, claim, complete, fail, cancel, retry, and dead-letter behavior.

## Consequences

- Workers must be idempotent.
- Duplicate task submissions return existing work.
- A claimed task may be retried if processing fails.
- Dead-letter handling is explicit after retry exhaustion.

## Alternatives Considered

- Exactly-once processing: rejected because it is unrealistic across distributed providers.
- Fire-and-forget task execution: rejected because it loses auditability and retry safety.
