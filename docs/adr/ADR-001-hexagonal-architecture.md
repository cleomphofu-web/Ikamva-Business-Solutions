# ADR-001 Hexagonal Architecture

## Status

Accepted

## Context

Ikamva must remain independent of any single infrastructure provider. Business workflows should survive changes to authentication, database, storage, AI, email, hosting, and worker platforms.

## Decision

Ikamva uses a hexagonal architecture:

```text
Application Core
  ↓
Services
  ↓
Repositories
  ↓
Providers
  ↓
Infrastructure
```

Provider-specific code belongs at the edge. Business rules live in services and execution engines.

## Consequences

- Business logic remains portable.
- Provider adapters can be replaced independently.
- More interfaces are required upfront.
- Tests can run against in-memory adapters before production providers exist.

## Alternatives Considered

- Direct provider SDK usage in application code: rejected because it couples business logic to infrastructure.
- Monolithic backend modules: rejected because it makes capability growth harder.
