# Security policy

## Reporting a vulnerability

Please **do not open a public GitHub issue** for security problems. Instead:

- Use **[GitHub's private security advisory](https://github.com/kolia-zamnius/kharko-dozor-dashboard/security/advisories/new)** (preferred), or
- Email **kolia@chattyinsights.com** with the subject line `SECURITY — kharko-dozor-dashboard`.

A useful report typically includes:

- A concise description of the issue and the potential impact.
- Steps to reproduce (or a minimal proof-of-concept).
- Which version / commit you tested against.
- Your suggested remediation, if any.

You will get an initial acknowledgement within **72 hours** and a substantive reply
within **7 days**. The issue will be tracked privately until a fix ships, at which
point the reporter is credited in the release notes unless they prefer to stay
anonymous.

## Scope

**In scope:**
- The dashboard application in this repository (`src/app`, `src/api-client`, `src/server`, `src/lib`, `prisma/`).
- The ingest API (`/api/ingest`) — reachable with a project public key.
- Auth flows — OAuth (Google / GitHub), Email OTP, Passkey (WebAuthn).
- Permission surface — RBAC rules enforced by `src/server/auth/permissions.ts`.
- The `/api/cron/*` surface — secured via `Authorization: Bearer $CRON_SECRET`.

**Out of scope:**
- The tracker SDK itself — reported at
  [`kolia-zamnius/kharko-dozor-packages`](https://github.com/kolia-zamnius/kharko-dozor-packages/security/advisories/new).
- Third-party services (Neon, Vercel, Google, GitHub, Gmail SMTP) — report those
  to their respective vendors.
- Denial of service via sheer volume against public endpoints (the project has
  rate-limiting on OTP and invite sends, but ingest is intentionally high-throughput;
  infrastructure-layer DoS is Vercel's / Neon's concern).
- Issues that require an already-compromised platform user account (e.g., session
  cookie theft outside the app's control).

## Security-relevant defaults

Worth knowing when assessing a report:

- Session cookies are managed by **Auth.js v5** with JWT sessions.
- OTP codes expire after one use; rate-limit is 5/day per email (`OTP_DAILY_LIMIT`).
- Invite emails expire after 3 days (`INVITE_EXPIRY_DAYS`); invite sends are
  rate-limited to 100/day per signed-in user (`INVITE_DAILY_LIMIT`) — set
  below the shared Gmail SMTP quota so abusive sends trip the guard before
  exhausting the OTP channel.
- API keys are stored in plaintext but read through a **branded type**
  (`ApiKeyPlaintext`) at the trust boundary — see `src/lib/mask-api-key.ts` and
  `src/server/generate-api-key.ts`. The list endpoint returns masked keys only;
  plaintext is fetch-on-copy via a dedicated `Cache-Control: no-store` endpoint.
- RBAC is double-validated: UI hides affordances **and** the API returns 403.
- Secrets live in `.env` / Vercel env vars — never hard-coded. The zod schema in
  `src/server/env.ts` is the canonical list of what the app reads at runtime.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`) are set in `next.config.ts`.

## Things that would count as a bug

Non-exhaustive list — reach out even if you're unsure:

- An authenticated user reading or mutating data in an organisation they don't
  belong to.
- Bypass of the ingest rate limits or OTP / invite rate limits.
- A stored XSS via tracked-user traits, organisation names, or project names
  rendered on the dashboard.
- Any pathway that exposes `Project.key` plaintext through an endpoint that
  should return the masked form.
- Secrets or environment values reaching client-side bundles (`.env` leak).
- Any CSRF vector on a mutation endpoint.
