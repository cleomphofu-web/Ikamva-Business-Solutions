# ADR-003 Queue Semantics

## Status

Accepted

## Context

Ikamva workers must safely process tasks when retries, timeouts, duplicate submissions, multiple worker processes, and worker failures occur.

The production queue will use PostgreSQL. This ADR defines the behavior every persistence implementation must satisfy before Supabase repositories are implemented.

## Decision

Queue semantics are at-least-once. Every task submission must include an idempotency key. QueueService owns enqueue, claim, complete, fail, cancel, retry, and dead-letter behavior.

Production PostgreSQL implementations must claim work with row-level pessimistic locking:

```sql
SELECT id
FROM task_queue
WHERE tenant_id = $1
  AND status = 'pending'
  AND scheduled_for <= now()
ORDER BY priority ASC, created_at ASC
FOR UPDATE SKIP LOCKED
LIMIT $2;
```

The claim update must run in the same transaction as the locked select. Claimed rows are updated to `processing`, with `locked_at`, `locked_by`, and `updated_at` set atomically.

## Worker Claiming Algorithm

1. Worker asks QueueService to claim eligible work for a tenant and optional task types.
2. Repository starts a transaction.
3. Repository selects eligible `pending` rows ordered by `priority ASC, created_at ASC`.
4. Repository locks rows with `FOR UPDATE SKIP LOCKED`.
5. Repository updates locked rows to `processing`.
6. Repository commits.
7. QueueService emits the required audit event.

Workers may run in multiple processes. Competing workers must never receive the same claim result from the same eligible row.

## Locking Model

Claiming uses pessimistic locking because queue claims are contention-heavy and must prevent duplicate claims.

State transitions after claim may use optimistic guards. A completion, cancellation, retry, or failure should only update the row if the current state is valid for that transition. Invalid transitions must return no updated task or raise a domain error through the service layer.

## Visibility Timeout And Crash Recovery

Processing rows are considered abandoned when `locked_at` is older than the configured visibility timeout and the task is not terminal.

The repository contract includes `recoverExpiredLocks()` so production implementations can move abandoned `processing` tasks back to `pending` or dead-letter them when retry exhaustion has already been reached.

Recovered tasks must:

- increment `retry_count` if the work may run again.
- set `scheduled_for` according to retry backoff.
- clear `locked_at` and `locked_by`.
- emit an immutable task log entry through QueueService or a controlled recovery service.

## Retry Schedule

Retries use exponential backoff with bounded delay.

Default schedule:

- Retry 1: 30 seconds.
- Retry 2: 2 minutes.
- Retry 3: 10 minutes.

Future implementations may add jitter, but jitter must not exceed the configured maximum retry delay.

## Dead-Letter Policy

Default maximum retries: `3`.

When `retry_count >= maxRetries`, retryable failure must transition the task to `failed` and emit `TASK_DEAD_LETTERED`. Dead-lettered tasks remain in `task_queue` with immutable history in `task_logs`.

Dead-letter status is represented by `failed` plus the dead-letter audit event and metadata. A separate dead-letter table is intentionally not introduced in this milestone.

## Idempotency And Duplicate Tasks

Task submission must preserve uniqueness for `(tenant_id, idempotency_key)`.

Duplicate submissions with the same tenant and idempotency key must return the existing task. They must not overwrite payload, normalized payload, status, priority, retry count, or audit history.

The same idempotency key may be reused by different tenants without collision.

## Cancellation Semantics

Cancellation is allowed for non-terminal tasks through QueueService. A cancelled task must not be claimable. Cancellation must write a `TASK_CANCELLED` audit event with the cancellation reason.

If a worker attempts to complete, retry, or fail a task that was already cancelled, the repository must prevent the stale transition.

## Quota Exceeded Handling

Quota failures transition tasks to `quota_exceeded`. These tasks are terminal for the current billing cycle unless a future explicit requeue operation is introduced.

Quota-exceeded tasks must not be claimable. They must emit `QUOTA_EXCEEDED` audit history and must not increment completed task counts.

## Operational Metrics

Repositories must expose enough data for operational telemetry without leaking provider details:

- queue depth by status and tenant.
- processing latency.
- retry counts.
- dead-letter count.
- quota failure count.
- completed task throughput.

## Consequences

- Workers must be idempotent.
- Duplicate task submissions return existing work.
- A claimed task may be retried if processing fails or a lock expires.
- Dead-letter handling is explicit after retry exhaustion.
- Supabase adapters can be implemented against a finished behavioral specification.

## Alternatives Considered

- Exactly-once processing: rejected because it is unrealistic across distributed providers.
- Fire-and-forget task execution: rejected because it loses auditability and retry safety.
- Advisory locks: rejected for the first production implementation because row-level locks map directly to queue rows and are easier to inspect.
- External brokers: rejected for this phase to keep persistence decisions PostgreSQL-first.
