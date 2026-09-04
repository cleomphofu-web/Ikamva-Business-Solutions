# Client Pages DOX

## Purpose
Own authenticated client onboarding and Mission Control workflows.

## Ownership
Client pages compose API clients and present tenant-scoped employee, knowledge, schedule, rule, skill, job, and integration state.

## Local Contracts
- Persist changes through backend services before advancing workflow steps.
- Keep paid skills gated and never claim an integration is connected without server confirmation.
- Preserve loading, failure, and refresh-resume behavior.

## Work Guidance
- Keep domain persistence out of page-local storage and direct database calls.

## Verification
- `npm run build`
- Browser verification of onboarding and Mission Control flows.

## Child DOX Index
None.
