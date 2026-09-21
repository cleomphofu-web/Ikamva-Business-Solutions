# Components DOX

## Purpose
Own reusable UI, dashboard widgets, visual effects, and presentation primitives.

## Ownership
Components receive data and callbacks from pages/hooks; API and provider concerns remain outside this boundary.

## Local Contracts
- No direct Supabase queries or provider SDK imports.
- Handle partial API data safely with loading and empty fallbacks.
- Preserve accessible controls and visible error states.

## Work Guidance
- Prefer composition and small, replaceable visual components.

## Verification
- `npm run build`
- `npm run lint`

## Child DOX Index
None.
