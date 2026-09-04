# AI Agent Engineering Rules

This file contains permanent rules for every AI coding assistant working on the Ikamva AI Operating System.

These rules are mandatory.

## Architecture Rules

- Never bypass repository interfaces.
- Never bypass service interfaces.
- Never allow UI components to import providers.
- Never couple business logic to infrastructure.

## Database Rules

- Never query Supabase directly from React components.
- Every database operation must go through repositories.
- Repository implementations are replaceable.

## Security Rules

- Preserve tenant isolation.
- Never expose service-role keys.
- Never bypass authorization.
- Secrets belong only on the backend.

## Execution Rules

- Every task transition must generate an audit event.
- All persistence implementations must satisfy repository contract tests.
- Idempotency must be preserved.
- Queue semantics must remain at-least-once.

## Testing Rules

Every repository implementation must pass:

- enqueue
- claim
- complete
- retry
- cancel
- dead-letter
- quota
- idempotency
- concurrent claim

Never merge code that breaks the repository contracts.

## Coding Standards

- Prefer composition.
- Keep modules small.
- Avoid circular dependencies.
- Prefer dependency injection.
- Document architectural decisions.
- Do not introduce vendor-specific code into business logic.
