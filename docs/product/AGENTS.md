# Product Specifications DOX

## Purpose

Own durable product, technical, schema, application-flow, implementation-plan, and UI specification source material.

## Ownership

- `PRD.md` owns product goals, users, scope, and safety promises.
- `TRD.md` owns technical requirements and non-negotiable implementation constraints.
- `ARCHITECTURE.md` owns system boundaries and architectural decisions.
- `SCHEMA.md` owns the documented database model.
- `APP_FLOW.md` owns user journeys and lifecycle flow.
- `AGENTS_AND_IMPLEMENTATION.md` owns worker/agent behavior and implementation sequencing.
- `CODEX_UI_PROMPT.md` owns the product UI direction and design constraints.

## Local Contracts

- These documents are source specifications, not substitutes for executable code, migrations, or tests.
- Keep claims aligned with the implemented repository and mark gaps rather than silently inventing behavior.
- Never weaken the root architecture, security, tenant-isolation, or approval-gate rules.

## Work Guidance

- Update the relevant specification when a durable contract changes.
- Cross-check schema claims against `supabase/migrations/` and API claims against `backend/` before declaring implementation complete.

## Verification

- Review changed specifications against the source tree.
- Run the applicable backend/build checks when specification changes accompany code changes.

## Child DOX Index

None.
