# ADR-006 Provider Registry

## Status

Accepted

## Context

AI, email, storage, calendar, notification, and future providers will change. The execution engine should not use provider-specific conditionals.

## Decision

Providers are registered through ProviderRegistry. Workers request providers by name and interact through provider interfaces.

## Consequences

- Provider adapters become plug-ins.
- Multiple AI providers can coexist.
- Worker logic remains independent of vendor SDKs.
- Provider selection can later be driven by tenant, SOP, cost, or reliability.

## Alternatives Considered

- Switch statements per provider: rejected because provider logic spreads through business code.
- Single hardcoded provider: rejected because it undermines vendor independence.
