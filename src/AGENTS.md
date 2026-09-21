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
- Form inputs use explicit high-contrast text (#fafaf9) and accent caret colors (#fcfc03) to prevent browser autofill contrast issues.
- All public and internal branding must use Ikamva Business Solutions (or Ikamva), not legacy template names.
- APP_FLOW.md spec routes that differ from implemented paths are maintained as `<Navigate>` aliases in `App.jsx`. Do not remove them — they preserve external-link and bookmark compatibility. The alias map lives in `docs/product/APP_FLOW.md` Screen Inventory.

## Verification
- `npm run build`
- `npm run lint`

## Child DOX Index
- `pages/client/AGENTS.md`
- `pages/admin/AGENTS.md`
- `components/AGENTS.md`
