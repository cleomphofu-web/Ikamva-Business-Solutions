# Repository Contracts

## Purpose

Repository contracts define the behavior persistence implementations must satisfy. Services, workers, and React components must not depend on provider SDKs or raw database queries.

Every implementation must pass the reusable repository contract suite before it can be considered production-ready.

## Tenant Scoping

Tenant-owned repositories must be created through `RepositoryFactory.forTenant(tenantId)`.

Tenant-scoped repositories must inject tenant context into every create, read, claim, update, retry, quota, and log operation. They must not expose records from another tenant.

System repositories are available only through `RepositoryFactory.forSystem()` for controlled backend operations such as migrations, telemetry, maintenance, and administrative recovery.

## TaskQueueRepository

Required methods:

- `findById(id)`
- `findByIdempotencyKey(tenantId, idempotencyKey)`
- `create(input)`
- `claimNext(options)`
- `updateStatus(id, status, patch)`
- `scheduleRetry(id, patch)`
- `recoverExpiredLocks(options)`
- `getOperationalMetrics(options)`

Guarantees:

- `create` defaults new tasks to `pending` and preserves tenant context.
- `findByIdempotencyKey` enforces tenant-scoped duplicate detection.
- `claimNext` is atomic and safe under concurrent workers.
- `claimNext` only returns eligible `pending` tasks whose `scheduled_for` is due.
- `claimNext` sets `locked_at`, `locked_by`, and `processing`.
- `updateStatus` must reject or ignore invalid stale transitions.
- `scheduleRetry` increments retry count, clears locks, sets `pending`, and moves `scheduled_for` forward.
- `recoverExpiredLocks` handles abandoned `processing` tasks according to visibility timeout and retry policy.
- `getOperationalMetrics` returns queue depth, latency, retries, dead-letter count, quota failures, and throughput.

## TaskLogRepository

Required methods:

- `append(input)`
- `listByTaskId(taskId)`

Guarantees:

- task logs are append-only.
- every task creation and state transition has a log entry.
- log reads remain tenant-scoped when accessed through `RepositoryFactory.forTenant()`.
- logs include enough metadata to distinguish normal failure from dead-letter failure.

## TenantRepository

Required methods:

- `findClientProfileById(id)`
- `findTenantForUpdate(input)`
- `incrementTasksUsed(clientProfileId)`

Guarantees:

- client profiles are tenant-scoped.
- quota reads must be consistent enough to prevent accidental over-processing.
- completed task increments happen only after successful completion.
- quota-exceeded tasks must not increment completed usage.

## SOPRepository

Required methods:

- `findActiveByTaskType(input)`
- `findLatestVersion(input)`

Guarantees:

- active SOP lookup is tenant-scoped.
- latest-version lookup is tenant-scoped.
- repositories must not return inactive SOPs for active execution.

## Contract Test Coverage

The current reusable contract suite covers:

- enqueueing
- tenant context injection
- tenant isolation
- unscoped construction failure
- explicit system repository access
- duplicate idempotency keys
- task claiming
- concurrent claims
- retries
- completion
- cancellation
- failure
- quota exceeded
- completed quota increments
- dead-letter behavior

Future Supabase repositories must run this same suite without changing assertions.
