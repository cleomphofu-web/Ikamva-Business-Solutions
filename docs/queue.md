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

1. `status`
2. `scheduled_for`
3. `priority`
4. `created_at`

Workers must set:

- `locked_at`
- `locked_by`
- `status = processing`

## Idempotency

`task_queue` enforces unique `(tenant_id, idempotency_key)` values. API entry points should generate stable idempotency keys for repeated client submissions.

## Logging

`task_logs` stores immutable history for every creation and status transition. This supports auditability, debugging, client reporting, and future analytics.

## Retry Policy

Retry policy is not hardcoded in this phase. The schema supports `retry_count` and `scheduled_for`, and the worker layer will own backoff rules in a later phase.
