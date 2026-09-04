# Plugins DOX

## Purpose
Own external integration adapters and plugin manifests.

## Ownership
Plugins translate external APIs into application provider contracts.

## Local Contracts
- OAuth secrets and access tokens remain server-side and encrypted at rest.
- Keep live OAuth behavior explicit, tenant-scoped, and approval-gated for consequential actions.
- Do not let UI components import plugin/provider SDKs.

## Work Guidance
- Preserve audit events around external actions and use idempotency keys where supported.

## Verification
- `npm run test:backend`

## Child DOX Index
- `ikamva-gmail/` — Gmail MCP/plugin adapter boundary (no nested AGENTS file required yet).
