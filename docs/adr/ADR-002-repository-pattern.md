# ADR-002 Repository Pattern

## Status

Accepted

## Context

Ikamva needs persistence implementations that can change over time without rewriting services or workers.

## Decision

All database access must go through repositories. Services and workers depend on repository contracts, not provider SDKs or raw queries.

## Consequences

- Supabase adapters can be added later without changing business logic.
- In-memory repositories can satisfy the same contracts for tests.
- Repository contract tests become mandatory.
- Developers must resist direct database shortcuts.

## Alternatives Considered

- Querying Supabase directly from services: rejected because it leaks provider details.
- Querying Supabase directly from React components: rejected because it breaks security and architecture boundaries.
