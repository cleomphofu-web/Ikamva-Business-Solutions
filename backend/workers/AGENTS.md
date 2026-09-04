# Worker DOX

## Purpose
Own queue polling, task execution, retries, audit transitions, and scheduled triggers.

## Ownership
Workers invoke services and providers through injected interfaces and persist lifecycle state through repositories.

## Local Contracts
- Every transition emits its audit event.
- Queue processing remains at-least-once and idempotent.
- Long-running provider work must not block the HTTP request path.

## Work Guidance
- Treat startup backfills and scheduled work as non-fatal background tasks.
- Keep task types and SOP contracts stable unless all references are updated.

## Verification
- `npm run test:backend`

## Child DOX Index
None.
