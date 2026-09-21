# Backend DOX

## Purpose
Own the HTTP API, application services, provider adapters, dependency injection, and worker runtime.

## Ownership
- API handlers authenticate requests and delegate to services/repositories.
- Services contain use cases; providers remain replaceable infrastructure adapters.
- Runtime startup must remain resilient to non-critical background failures.

## Local Contracts
- Preserve tenant isolation and never expose service-role credentials.
- Use `RepositoryFactory.forTenant(tenantId)` for tenant data.
- Emit audit events for every task transition and preserve idempotency.

## Work Guidance
- Keep provider-specific code behind provider interfaces/registries.
- Keep React-independent business logic in backend modules.
- Gmail push: `GmailWatchService` manages watch registration and history deltas. The `gmail-push.js` handler always returns 204 to prevent Pub/Sub retry storms. `PUBSUB_TOPIC` env var gates all push behaviour; polling continues when it is unset.

## Verification
- `npm run test:backend`
- `npm run build`

## Child DOX Index
- `repositories/AGENTS.md`
- `workers/AGENTS.md`
