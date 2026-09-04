# Repository DOX

## Purpose
Define replaceable persistence implementations and tenant-scoped repository contracts.

## Ownership
Repositories own database reads/writes; callers do not bypass them.

## Local Contracts
- Tenant repositories require an explicit tenant identity.
- Preserve queue at-least-once semantics and idempotency.
- Maintain contract coverage for enqueue, claim, completion, retry, cancellation, dead-letter, quota, idempotency, and concurrent claim.

## Work Guidance
- Match existing factory and dependency-injection patterns.
- Do not place provider SDK calls in repositories.

## Verification
- `npm run test:backend`

## Child DOX Index
None.
