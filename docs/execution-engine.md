# Execution Engine

Goal B turns the schema and interfaces into an executable backend lifecycle. Provider integrations can still be mocked, but task intake, idempotency, queue transitions, SOP loading, quota checks, provider selection, worker execution, and audit emission now have concrete orchestration classes.

## Flow

```text
QueueService.enqueueTask()
  -> idempotency check
  -> task creation
  -> TASK_CREATED audit event

WorkerEngine.processNext()
  -> QueueService.claimNextTask()
  -> WorkerRegistry.get(task_type)
  -> SOPService.loadActiveSOP()
  -> SOPService.validateInput()
  -> QuotaService.ensureWithinQuota()
  -> ProviderRegistry.get(provider)
  -> Worker.execute()
  -> QueueService.completeTask() or failTask()
```

## Queue Service

QueueService owns task lifecycle transitions:

- `enqueueTask`
- `claimNextTask`
- `completeTask`
- `failTask`
- `cancelTask`
- `retryTask`

Workers do not query the database directly. They receive claimed task data and call service methods.

## Idempotency

`enqueueTask` checks `(tenant_id, idempotency_key)` before creating work. Duplicate submissions return the existing task.

## Audit Pipeline

Audit events are emitted by QueueService and WorkerEngine:

- `TASK_CREATED`
- `VALIDATION_STARTED`
- `VALIDATION_COMPLETED`
- `QUOTA_APPROVED`
- `WORKER_STARTED`
- `AI_REQUESTED`
- `AI_COMPLETED`
- `RESULT_VALIDATED`
- `TASK_COMPLETED`
- `TASK_FAILED`
- `TASK_DEAD_LETTERED`
- `TASK_CANCELLED`
- `TASK_RETRY_SCHEDULED`
- `QUOTA_EXCEEDED`

## Registries

ProviderRegistry maps provider names to provider adapters.

WorkerRegistry maps task types to workers.

This prevents provider or worker switch statements from spreading through the codebase.

## Development Adapters

In-memory repositories and `MockAIProvider` allow the execution engine to run without vendor SDKs. Production adapters should implement the same repository and provider contracts.
