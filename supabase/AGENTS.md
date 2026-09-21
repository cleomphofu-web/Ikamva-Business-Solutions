# Supabase DOX

## Purpose
Own schema migrations, database functions, indexes, RLS policies, and migration history.

## Ownership
SQL defines persistence guarantees; backend repositories are the application access boundary.

## Local Contracts
- Preserve tenant isolation and immutable audit semantics.
- Never manually insert migration-history rows; the Supabase CLI manages them.
- Show migration SQL for approval before applying schema changes unless approval is already explicit.

## Work Guidance
- Extend existing tables before creating duplicates.
- Reconcile local and remote migration history before deployment.

## Verification
- `npm run db:migration:check`
- `npm run db:lint`

## Child DOX Index
None.
