# Admin Pages DOX

## Purpose
Own administrative review, approval, provisioning, and operational displays.

## Ownership
Admin pages use authenticated API clients for applications, tenants, employees, approvals, and audit views.

## Local Contracts
- Preserve role checks and tenant/platform-admin boundaries.
- Keep approval actions explicit, auditable, and server-authorized.

## Work Guidance
- Do not duplicate backend authorization in a way that weakens it.

## Verification
- `npm run build`
- Browser verification of admin approval flows.

## Child DOX Index
None.
