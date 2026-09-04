# Frontend DOX

## Purpose
Own the browser application, routes, presentation state, and application API clients.

## Ownership
- Components render and dispatch through API/service clients.
- `src/lib/ikamva` owns HTTP client contracts and auth header handling.

## Local Contracts
- Never query Supabase directly from React.
- Never import provider SDKs into presentation components.
- Do not store durable domain records in localStorage when a backend path exists.
- Keep secrets out of browser bundles and state.

## Work Guidance
- Show explicit loading, empty, and error states.
- Preserve tenant and role boundaries enforced by backend APIs.

## Verification
- `npm run build`
- `npm run lint`

## Child DOX Index
- `pages/client/AGENTS.md`
- `pages/admin/AGENTS.md`
- `components/AGENTS.md`
