# ADR-004 Tenant Isolation

## Status

Accepted

## Context

Ikamva is a multi-tenant operating system for SMEs. Tenant data must remain isolated across UI, services, repositories, workers, and provider adapters.

## Decision

Tenant context is mandatory for tenant-owned data. Database tables include tenant scoping, and repository implementations must apply tenant filters. Row Level Security should enforce this at the database layer.

## Consequences

- Tenant isolation is enforced in multiple layers.
- Service-role operations must be tightly controlled.
- Repository contracts must include tenant-aware access patterns.

## Alternatives Considered

- Single-tenant data model: rejected because it does not fit the platform vision.
- Tenant isolation only in UI: rejected because it is not a security boundary.
