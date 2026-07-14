# Security

## Tenant Isolation

Tenant isolation is the primary security boundary. Every persisted business object must be scoped to a tenant. Services and repositories must require tenant context before reading or writing tenant-owned data.

Tenant IDs must not be inferred from user-controlled request payloads without authorization checks.

## Row Level Security

Supabase PostgreSQL should use Row Level Security for tenant-scoped tables. Policies should ensure that authenticated users can only access rows for tenants where they have an authorized tenant-user relationship.

Service-role access must be reserved for backend execution contexts that perform controlled system operations.

## Repository Scoping

Repositories must enforce tenant scoping in their method contracts. Callers should pass tenant context explicitly, and repository implementations should apply that context to every query.

React components must not query database providers directly.

## Service-Role Responsibilities

Service-role credentials may only be used by backend services, workers, or controlled server-side integration layers.

Service-role operations must be auditable and should be limited to cases where user-scoped authorization is not enough, such as worker execution, queue claiming, administrative maintenance, and scheduled system tasks.

## Audit Logging

Every task transition must produce an audit event. Audit logs support operational debugging, client accountability, compliance review, and incident investigation.

Audit logs should be append-only. Updates and deletes should be blocked except through explicitly approved retention tooling.

## Secrets Management

Secrets must never be committed to the repository.

Frontend code must only receive public configuration. Private keys, service-role keys, provider API keys, webhook secrets, and signing secrets belong only in backend runtime environments.

## Quota Enforcement

Quota checks are a safety control as well as a billing control. Workers must validate remaining quota before processing client work. Completed work should increment quota usage through the quota service.

Quota bypasses must not be implemented in workers or UI components.

## Worker Isolation

Workers should claim tasks through QueueService. Workers must not directly mutate task rows or bypass audit emission.

Worker credentials should be scoped to the smallest set of repositories, providers, and tenant operations required for their capability.

## Idempotency

Task submission must preserve idempotency. Duplicate requests with the same tenant and idempotency key must return the existing task rather than creating duplicate work.

This protects against webhook retries, browser retries, network timeouts, and accidental duplicate submissions.

## Input Validation

Input validation should happen before quota-consuming execution. SOP validation schemas define required fields and output expectations. Provider responses must be validated before completion.

Invalid input should fail safely and produce audit history.

## Least Privilege

Every service, worker, provider adapter, and repository implementation should operate with the least privilege needed to perform its job.

No component should receive broad infrastructure access when a narrow repository or service method is sufficient.
