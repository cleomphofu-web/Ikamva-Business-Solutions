# ADR-008 Repository Factory and Dependency Injection

## Status

Accepted

## Context

The execution engine must prove infrastructure independence before Supabase adapters are introduced. Repository implementations should be replaceable, but tenant isolation must remain mandatory.

Services should not know whether persistence is in-memory, Supabase, or another provider. Workers should receive services and repositories through composition rather than constructing infrastructure directly.

## Decision

Ikamva uses `RepositoryFactory.forTenant(tenantId)` to create tenant-scoped repositories:

```text
RepositoryFactory.forTenant(tenantId)
  -> taskQueue
  -> taskLogs
  -> sops
  -> tenants
```

Tenant context is mandatory. Calling `forTenant()` without a tenant ID fails.

Cross-tenant repositories are available only through `RepositoryFactory.forSystem()`. This path is reserved for controlled backend operations such as migrations, maintenance, telemetry, and administrative worker tasks.

Ikamva also uses a small explicit `ServiceContainer` for dependency injection. Registrations are manual. There is no reflection, auto-wiring, decorator usage, or external DI framework.

## Consequences

- Tenant isolation is enforced at repository construction.
- Services and workers remain unaware of persistence implementation details.
- In-memory and future Supabase repositories can satisfy the same contract suite.
- System-wide access is explicit and auditable in code review.
- Dependency graphs stay simple and inspectable.

## Alternatives Considered

- Passing `tenantId` into every repository method: rejected because it is easy to forget and weakens isolation.
- Global singleton repositories: rejected because they encourage cross-tenant access.
- External dependency injection framework: rejected because the project only needs explicit composition.
- Supabase-specific factory now: rejected because this milestone must not introduce Supabase adapters.
