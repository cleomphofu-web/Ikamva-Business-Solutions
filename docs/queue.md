# Queue Architecture

## Purpose

The task queue is the durable coordination layer for AI-assisted work. It separates intake from execution and gives workers a safe place to claim, retry, defer, or cancel tasks.

## Queue States

- `pending`: task accepted and ready for validation.
- `validating`: payload and SOP checks are running.
- `waiting_quota`: validation passed and quota is being checked or deferred.
- `processing`: worker has claimed the task.
- `awaiting_human`: task requires human review or input.
- `completed`: task finished successfully.
- `failed`: task cannot continue.
- `cancelled`: task was intentionally stopped.
- `quota_exceeded`: task cannot run because the client has no monthly quota remaining.

## Worker Claiming

Workers should claim tasks ordered by:

1. `priority`
2. `created_at`

Workers must set:

- `locked_at`
- `locked_by`
- `status = processing`

Production PostgreSQL repositories must claim rows inside a transaction using `FOR UPDATE SKIP LOCKED`. The select and update must be atomic so multiple worker processes can compete without claiming the same task.

Eligible claim rows must have:

- `status = pending`
- `scheduled_for <= now()`
- matching `tenant_id`
- matching `task_type` when a worker is restricted to specific task types

## Worker Concurrency

The queue supports multiple worker processes. Race conditions are resolved by the repository implementation, not by worker memory. PostgreSQL implementations must rely on row-level locks and `SKIP LOCKED`.

Worker crashes are handled through visibility timeout recovery. A task in `processing` with an expired `locked_at` is abandoned and may be returned to `pending` with an incremented retry count or moved to dead-letter failure if retry limits are exhausted.

Heartbeat strategy: no heartbeat is required for the first production implementation. The initial design uses bounded execution timeout plus visibility timeout recovery. A heartbeat may be added later only if long-running tasks need lock extension without false recovery.

## Visibility Timeout

Default visibility timeout: `15 minutes`.

When a task exceeds the visibility timeout:

- clear `locked_at`
- clear `locked_by`
- increment `retry_count` when retrying
- reschedule with retry backoff
- preserve immutable task history

Expired locks must be recovered by a controlled backend worker or maintenance process, never by React components.

## Idempotency

`task_queue` enforces unique `(tenant_id, idempotency_key)` values. API entry points should generate stable idempotency keys for repeated client submissions.

## Logging

`task_logs` stores immutable history for every creation and status transition. This supports auditability, debugging, client reporting, and future analytics.

## Retry Policy

Default retry policy:

- maximum retries: `3`
- retry 1 delay: `30 seconds`
- retry 2 delay: `2 minutes`
- retry 3 delay: `10 minutes`
- maximum retry delay: `10 minutes`

Retries use exponential backoff. Future implementations may add jitter.

When retries are exhausted, the task transitions to `failed` and receives a `TASK_DEAD_LETTERED` audit event. Dead-letter behavior is represented by task status and immutable logs, not a separate table in this milestone.

## Cancellation

Cancelled tasks must not be claimable. Cancellation must emit `TASK_CANCELLED` with a reason. Stale workers must not be allowed to complete, retry, or fail a task after it has been cancelled.

## Quota Exceeded

Quota-exceeded tasks are terminal for the current billing cycle. They must not be claimable, must not consume completed-task quota, and must emit `QUOTA_EXCEEDED`.

## Configuration Defaults

- worker polling interval: `5 seconds`
- retry delays: `30 seconds`, `2 minutes`, `10 minutes`
- maximum retries: `3`
- queue batch size: `1` for the current WorkerEngine, `10` for future batch workers
- execution timeout: `10 minutes`
- visibility timeout: `15 minutes`

Configuration belongs in backend runtime settings. It must not be hardcoded into React components.

## Operational Observability

Minimum metrics:

- queue depth by tenant and status
- processing latency from claim to terminal state
- retry count and retry rate
- dead-letter count
- quota failure count
- task throughput by tenant and task type

Metrics may be emitted by workers, QueueService, or repository adapters, but provider-specific telemetry code must remain behind service or repository boundaries.
