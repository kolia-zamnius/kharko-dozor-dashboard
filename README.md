# Kharko Dozor Dashboard

Web dashboard for [Kharko Dozor](https://github.com/kolia-zamnius/kharko-dozor-packages) — open-source session recording and replay platform. Watch user sessions, manage projects, track users. Free for everyone, forever.

Built under the **Kharko** brand, inspired by Kharkiv, Ukraine.

## Stack

Next.js 16 · TypeScript · Tailwind CSS v4 · Radix Primitives · PostgreSQL (Neon) · Prisma · Auth.js v5 · TanStack Query · Zustand · rrweb (replay)

## Features

- **Marketing landing** — public homepage at `/` with product preview, install snippets, SDK docs link
- **Session Replay** — custom rrweb player with Shadow DOM isolation, idle-skip, seek markers, slice picker, console panel
- **Session Slices** — independently replayable segments (page navigation, idle detection)
- **Tracked Users** — user profiles with traits, activity timeline, session history
- **Organizations** — personal spaces, team orgs, member roles, email invites; API keys inline per org
- **Auth** — Google OAuth, GitHub OAuth, email OTP, Passkeys (WebAuthn)
- **i18n** — six locales (English, Ukrainian, German, Spanish, Portuguese, Italian); per-user persisted preference; locale-aware dates, formatters, Zod errors, mutation toasts

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+
- [Neon](https://neon.tech) database (or any PostgreSQL)
- Docker — **only for running tests** ([OrbStack](https://orbstack.dev/) or [Docker Desktop](https://www.docker.com/products/docker-desktop) on macOS). Not needed for `npm run dev`.

### Setup

```bash
git clone https://github.com/kolia-zamnius/kharko-dozor-dashboard.git
cd kharko-dozor-dashboard
npm install

# Configure environment
cp .env.example .env
# Fill in AUTH_SECRET, OAuth keys, Gmail SMTP credentials, DATABASE_URL, DATABASE_URL_UNPOOLED
```

### Environment variables

Canonical schema lives in [`src/server/env.ts`](./src/server/env.ts) (zod-validated; invalid env fails boot loudly).

| Variable                | Required?               | Description                                                       |
| ----------------------- | ----------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`          | **yes**                 | Neon pooled connection string (app queries)                       |
| `DATABASE_URL_UNPOOLED` | optional                | Neon direct connection string (migrations / one-off scripts)      |
| `AUTH_SECRET`           | **yes**                 | Auth.js session secret                                            |
| `AUTH_URL`              | optional                | Auth.js base URL override; defaults to request host               |
| `APP_URL`               | recommended             | Absolute app URL (`http://localhost:3000` dev). Used for server-side `apiFetch`, SEO canonical, sitemap, OG images |
| `AUTH_GOOGLE_ID`        | optional                | Google OAuth Client ID (provider hidden if absent)                |
| `AUTH_GOOGLE_SECRET`    | optional                | Google OAuth Client Secret                                        |
| `AUTH_GITHUB_ID`        | optional                | GitHub OAuth Client ID (provider hidden if absent)                |
| `AUTH_GITHUB_SECRET`    | optional                | GitHub OAuth Client Secret                                        |
| `GMAIL_USER`            | **yes**                 | Gmail address used as the SMTP sender (email OTP + invites)       |
| `GMAIL_APP_PASSWORD`    | **yes**                 | Gmail App Password (16 lowercase letters, no spaces)              |
| `CRON_SECRET`           | **yes in prod**         | Shared bearer for `Authorization: Bearer …` on `/api/cron/*`      |
| `VERCEL_URL`            | auto (Vercel)           | Fallback base URL when `APP_URL` isn't set                        |
| `SENTRY_DSN`            | recommended in prod     | Paste from [sentry.io](https://sentry.io) → your project → Client Keys (DSN). Unset = Sentry no-ops; logs still go to stdout via pino |
| `LOG_LEVEL`             | optional                | pino level (`fatal`/`error`/`warn`/`info`/`debug`/`trace`/`silent`). Defaults: `debug` in dev, `info` in prod, `silent` in tests |

#### Sentry — where to put the DSN

Do **not** commit `SENTRY_DSN` to any committed file (`.env.example`, `.env.test`). Even though the DSN looks "public", any actor with it can flood your error quota. The right places:

- **Vercel** (production): Project Settings → Environment Variables → add `SENTRY_DSN`, scope to **Production** only (Preview / Development would generate noise from your own experiments).
- **`.env.local`** (gitignored): only if you want local dev errors to land in Sentry — usually you don't.
- **`.env.example`** / **`.env.test`**: leave empty. The code no-ops cleanly when DSN is absent.

A `console.warn` fires at boot if `NODE_ENV=production` and `SENTRY_DSN` is unset, so you can't silently lose error reporting after a Vercel env change.

### Database

```bash
# Push schema to your dev DB (no migration artefacts committed — this project uses `db push` only)
npx prisma db push

# Generate Prisma client (auto-runs on npm install)
npx prisma generate
```

### Development

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

Dashboard runs at [http://localhost:3000](http://localhost:3000).

## Tests

Backend-focused suite running on **Vitest 3**. Frontend / React component tests are deliberately deferred — see the "Deferred" section in `CLAUDE.md`. The suite is organised into three Vitest **projects**, each scoped to what it needs:

| Project       | Path                          | Needs Docker? | What it covers                                                                      |
| ------------- | ----------------------------- | :-----------: | ----------------------------------------------------------------------------------- |
| `unit`        | `src/**/*.test.ts` (colocated) |      —       | Pure functions, HOFs with mocked Prisma, email HTML snapshots, zod-error-map, etc. |
| `contract`    | `tests/contract/**`           |      —       | OpenAPI 3.1 snapshot derived from the ingest zod schema. Runs in <1s.             |
| `integration` | `tests/integration/**`        |      ✓       | Route handlers against a real Postgres 17 via Testcontainers.                      |

Only the `integration` project needs Docker. If you're iterating on a pure-function change, `npm run test:unit` is fast (<2s) and requires no infrastructure.

### Commands

```bash
npm run test:unit         # colocated unit tests, no Docker
npm run test:contract     # OpenAPI snapshot diff, no Docker
npm run test:integration  # route suites against a real Postgres — needs Docker
```

One script per project, nothing else — keeping the set lean. Ad-hoc workflows use `vitest` directly:

```bash
npx vitest                                    # watch mode — re-runs on file change
npx vitest --ui                               # Vitest UI in the browser
npx vitest run                                # all projects at once
npx vitest run --project unit --coverage      # coverage for one project
UPDATE_OPENAPI=1 npm run test:contract        # regenerate OpenAPI snapshot
```

CI runs the three scripts as independent jobs (plus the `ci` job for lint / type-check / build), so each project's status shows up separately on a PR.

### How integration tests work

[Testcontainers](https://testcontainers.com/) spins up one ephemeral `postgres:17-alpine` container per test run (`tests/setup/global-setup.ts`), migrates the Prisma schema into a `template_test` database, then clones it per Vitest worker. Each worker gets an isolated `worker_${id}` database — no cross-worker races, no flaky inter-test pollution. Per-test `TRUNCATE ... RESTART IDENTITY CASCADE` keeps state clean within a worker.

Test env lives in `.env.test` (committed, dummy values — never real secrets). The real `DATABASE_URL` is injected at runtime after the container is up. Machine-local overrides go in `.env.test.local` (gitignored).

First run pulls the Postgres image (~30s); subsequent runs hit the Docker layer cache.

### OpenAPI contract

The ingest endpoint's zod schema is the wire contract with the `@kharko/dozor` npm SDK. `tests/contract/openapi.test.ts` generates an OpenAPI 3.1 document via Zod 4's native `z.toJSONSchema()` and compares it to the committed `openapi.snapshot.json`. Any change to the ingest envelope surfaces as a reviewable JSON diff in the PR — breaking wire-format changes are explicit, not discovered downstream.

Deliberate contract changes: run `UPDATE_OPENAPI=1 npm run test:contract` to refresh the snapshot, commit the JSON alongside the schema change.

### Helpers

All in `tests/helpers/`:

- `db.ts` — per-worker Prisma client via `@prisma/adapter-pg` + `truncateAll()`
- `factories.ts` — plain typed builders (`createUser`, `createOrganization`, `createProject`, `createSession`, `createInvite`, …) that return real DB rows
- `auth-mock.ts` — `buildSessionUser` + `buildSession` for `vi.mock("@/server/auth")`
- `invoke-route.ts` — `invokeRoute(handler, opts)` for single-arg (no params) route handlers
- `translator.ts` — `fakeTranslator` (echoes keys) + `realTranslator` (loads the real locale JSON via next-intl's `createTranslator`)
- `fixtures.ts` — loader for binary/JSON fixtures under `tests/fixtures/`

## SDK integration

Install the tracker SDK in your app to start recording sessions:

```bash
npm install @kharko/dozor
```

```ts
import { init } from "@kharko/dozor";

init({ publicKey: "dp_your_public_key" });
```

For React apps, see [`@kharko/dozor-react`](https://www.npmjs.com/package/@kharko/dozor-react) — wrap your tree in `<DozorProvider publicKey="dp_...">`. SDK source code: [kharko-dozor-packages](https://github.com/kolia-zamnius/kharko-dozor-packages).

## Deployment

Deployed on [Vercel](https://vercel.com) with [Neon](https://neon.tech) database integration.

## License

MIT — see the author's note in [`src/app/[locale]/(marketing)/page.tsx`](./src/app/%5Blocale%5D/%28marketing%29/page.tsx) (`SoftwareApplication` JSON-LD declares `https://opensource.org/licenses/MIT`). A standalone `LICENSE` file is the next housekeeping step.
