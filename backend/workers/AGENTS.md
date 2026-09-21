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
- `renewGmailWatch()` runs at startup; it is a no-op when `PUBSUB_TOPIC` is unset. The 5-minute polling loop is a permanent fallback — it uses per-message idempotency keys so it does not double-process messages already received via push.
- RAG grounding: Company knowledge retrieval is strictly tenant-isolated and filtered by `job_spec.knowledge_sources` when configured. Customer-facing fact queries with 0 matching chunks transition to `awaiting_human` (`KNOWLEDGE_HOLD`) with a pending record in `approval_queue`.

## Verification
- `npm run test:backend`

## Child DOX Index
None.
