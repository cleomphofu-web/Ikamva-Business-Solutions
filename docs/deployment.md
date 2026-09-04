# Worker deployment

The production worker is packaged with `Dockerfile.worker` and runs the
tenant-scoped process from `backend/workers/worker-process.js`.

Required runtime secrets/configuration:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (backend/worker secret only)
- `IKAMVA_TENANT_ID`

Optional production email delivery:

- `EMAIL_PROVIDER_URL` (defaults to `https://api.resend.com/emails`)
- `EMAIL_PROVIDER_API_KEY` (secret-manager only)
- `EMAIL_FROM` (a verified Resend sender identity)

When the API key and sender are configured, email tasks use the Resend-compatible
HTTP adapter. Otherwise the mock adapter remains available for local and
integration environments.

## Supabase Auth email delivery

Email confirmation remains enabled on the linked Supabase project. For local-only
development, an ignored `.env` may contain `SKIP_EMAIL_CONFIRMATION=true`; this
must never be committed or injected into staging/production. When enabled, the
signup UI explicitly tells the developer that confirmation is bypassed and the
user can sign in immediately. When absent or false, the normal Supabase
verification-email flow is used.

Configure Supabase Auth separately so signup confirmations, password resets,
and magic links use Resend SMTP:

1. Open **Project Settings → Authentication → SMTP Settings** in Supabase.
2. Enable **Custom SMTP**.
3. Set host to `smtp.resend.com` and port to `587`.
4. Set username to `resend` and password to the Resend API key.
5. Use a sender address/name from a verified Resend domain.

Never put the Resend API key in frontend variables or repository files.

## Development email workflow test

In development, an authenticated client may enqueue the deterministic quote
triage fixture with `POST /api/v1/dev/trigger-email-triage`. The endpoint is
disabled with a 404 response whenever `NODE_ENV` is not `development`; it still
uses the tenant-scoped queue and idempotency key and never sends email directly.

Copy `.env.example` only for local reference. In production, inject these
values through the platform secret manager or container runtime; never bake
`.env` files or service-role keys into the image. The worker validates all
three required values before creating its backend container.

Optional settings:

- `IKAMVA_WORKER_ID`
- `IKAMVA_WORKER_HEALTH_HOST` (defaults to `0.0.0.0` in the container)
- `IKAMVA_WORKER_HEALTH_PORT` (defaults to `4190`)
- `IKAMVA_WORKER_POLL_INTERVAL_MS` (defaults to `1000`)
- `IKAMVA_WORKER_LOCK_TIMEOUT_MINUTES` (defaults to `10`)

The container exposes `/healthz`. A healthy response requires the runtime to
be running and the tenant-scoped queue metrics query to succeed.

## Migration gate

Run `npm run db:migration:check` before deploying. It exits non-zero when
local and linked Supabase migration histories differ. Do not use `db push` or
repair history until the drift has been reviewed and the missing migration
definitions are either restored or an approved baseline/repair decision is
recorded.

The linked project was reconciled on 2026-08-25: the seven remote migration
definitions were fetched with `supabase migration fetch --linked`, and the
three newer migrations whose schemas had already been applied manually were
recorded in remote history with `supabase migration repair --linked --status
applied`. `npm run db:migration:check` now reports no local-only or remote-only
versions.
