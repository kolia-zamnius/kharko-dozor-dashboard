# Integration tests

Route handlers exercised against a real Postgres 17 spun up per-run via Testcontainers. Each file tests **one behaviour / lifecycle / invariant** — not one endpoint. Tests are grouped by behaviour because most interesting invariants (state machines, RBAC matrices, cascades) cross multiple route files.

Run with `npm run test:integration` (needs Docker). Per-test `truncateAll()` keeps state clean; per-worker DB clone from `template_test` keeps workers isolated.

## Scenario index

| File                                 | Behaviour under test                                   | Endpoints touched                                                                                | Key invariants                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `smoke.test.ts`                      | Testcontainers plumbing + per-worker clone             | —                                                                                                | Worker DB cloned from template, `truncateAll` works, factories round-trip                                                                                                      |
| `organizations.test.ts`              | Org CRUD + Personal-Space preservation                 | `POST/PATCH/DELETE /api/organizations[/*]`                                                       | Every user always has a PERSONAL space; deleting a TEAM org flips members' `activeOrganizationId` back                                                                         |
| `invites.test.ts`                    | Invite lifecycle state machine (send → accept)         | `POST/PATCH/DELETE /api/organizations/[orgId]/invites[/*]`, `POST /api/user/invites/[id]/accept` | Resend refreshes in place (idempotent); expiry = 3 days; accept creates membership atomically                                                                                  |
| `invite-decline.test.ts`             | Decline is a hard-delete                               | `POST /api/user/invites/[id]/decline`                                                            | No `DECLINED` status — row removed so admin list stays clean                                                                                                                   |
| `members.test.ts`                    | Role change + remove + self-leave + ownership transfer | `PATCH/DELETE /api/organizations/[orgId]/members/[memberId]`                                     | Last-owner leave auto-transfers to creator; Personal-Space can't be left; 409 when only-member tries to leave                                                                  |
| `active-org-switch.test.ts`          | `activeOrganizationId` safety                          | `PATCH /api/organizations/active`                                                                | Pointer can ONLY reference an org the caller is a member of — transactional membership check + update                                                                          |
| `projects-key-lifecycle.test.ts`     | API-key lifecycle (OWNER-only)                         | `POST/DELETE /api/projects`, `GET /api/projects/[id]/key`, `POST .../regenerate-key`             | Plaintext key leaves server ONLY via `GET /key` (`Cache-Control: no-store`); regenerate atomically invalidates old; delete cascades to sessions                                |
| `permissions-matrix.test.ts`         | ⭐ **RBAC matrix** (8 actions × 3 roles)               | Multiple across org/project/session/tracked-user                                                 | Below-rank callers get 403; matches `server/auth/permissions.ts` JSDoc contract                                                                                                |
| `ingest.test.ts`                     | SDK wire contract at `/api/ingest`                     | `POST/OPTIONS /api/ingest`                                                                       | Unknown public key → 401 **without existence oracle**; gzip body branch; identity payload links TrackedUser; OPTIONS preflight → 204 with CORS                                 |
| `cron-cleanup.test.ts`               | Daily housekeeping (ordered)                           | `GET /api/cron/daily-cleanup`                                                                    | Bearer auth required; ordered: throwaway sessions (below `MIN_REAL_SESSION_*` floor) → expired invites → sessions >90d → orphaned tracked-users → empty orgs (with `activeOrganizationId` nullify FIRST) |
| `sessions-detail.test.ts`            | Session + events + markers read shape                  | `GET /api/sessions/[id]`, `GET .../events`, `GET .../markers`                                    | Cross-org access → 404 (NOT 403 — avoids existence leak); events response carries base64-gzip blobs; `?kind=` filter on markers                                                |
| `locale-patch.test.ts`               | User locale update                                     | `PATCH /api/user/locale`                                                                         | Valid locale writes DB; invalid → 400 with localised zod issues                                                                                                                |
| `tracked-users-display-name.test.ts` | Display-name override (ADMIN-gated)                    | `PATCH /api/tracked-users/[userId]/display-name`                                                 | 4-level resolver chain; ADMIN gate (VIEWER → 403)                                                                                                                              |
| `user-profile.test.ts`               | Profile reads + edits                                  | `GET/PATCH/DELETE /api/user`                                                                     | Rename, delete-self with ownership transfer, confirmation literal guard                                                                                                        |
| `sessions-cancel.test.ts`            | SDK `stop()` teardown (public-key)                     | `POST/OPTIONS /api/sessions/cancel`                                                              | `(projectId, externalId)` scoping — cross-tenant hard-delete impossible; race-safe no-op; no existence oracle                                                                  |
| `passkey-delete.test.ts`             | Passkey rename + unregister                            | `PATCH/DELETE /api/user/passkeys/[credentialId]`                                                 | `(credentialID, userId)` scoping — foreign credentialID → 404 (no existence oracle)                                                                                            |
| `account-unlink.test.ts`             | Unlink a linked OAuth account                          | `DELETE /api/user/accounts/[provider]`                                                           | Cross-user isolation; 404 on absent provider; **409 last-login-method guard** — counts (other OAuth + passkeys + emailVerified-gated OTP), refuses unlink if sum would be zero |
| `tracked-users-list.test.ts`         | Users list with enrich/filter/sort                     | `GET /api/tracked-users`                                                                         | Org scoping drops stray `?projectIds=`; search matches externalId OR customName case-insensitively; cursor pagination dedup (fast-check)                                       |
| `sessions-list.test.ts`              | Sessions list (cursor-paginated)                       | `GET /api/sessions`                                                                              | Cross-org isolation; date-range preset filtering; cursor pagination dedup (fast-check)                                                                                         |

## What these tests DON'T cover (and why)

- **Per-route 401** — covered structurally by `tests/contract/route-auth-wrapper.test.ts` (every route must import `withAuth` or `withPublicKey`) + HOF unit tests (`src/app/api/_lib/with-{auth,public-key}.test.ts`). Duplicating per route is noise. The two surviving 401 assertions — in `cron-cleanup.test.ts` (Bearer auth, different mechanism) and `ingest.test.ts` (CORS + no-existence-oracle) — guard invariants specific to THOSE routes.
- **Rate-limit e2e** (e.g. 6th OTP in a day → 429) — only unit-tested at `bumpOtpRateLimit` level today. Promotion to integration is tracked as a gap.
- **WebAuthn / passkey flows** — zero integration coverage; NextAuth + `@simplewebauthn/server` tested upstream, but our adapter logic isn't.
- **Malformed gzip / oversized body at `/api/ingest`** — only valid gzip + size-bounded payloads exercised.
- **Concurrency races** (e.g. two simultaneous invite-resends) — rely on Prisma unique constraints; no property-based concurrency test.

## Conventions

- One behaviour per file. If a new behaviour crosses existing files, start a new one rather than appending.
- Factories from `tests/helpers/factories.ts` — they return real DB rows, so schema drift breaks tests on the first run.
- **Auth mock**: `import { mockAuth } from "../helpers/mocks"`. The three `vi.mock` calls for `@/server/auth` + `@/server/db/client` + `next-intl/server` live in `tests/setup/integration-mocks.ts` (integration-project setupFile), installed once before each test file loads. `mockAuth` is reset in a global `beforeEach` — test bodies never call `mockReset()` manually. Files that need a different `next-intl` stub (e.g. `invites.test.ts` for `t.markup` support) override the shared mock with their own `vi.mock("next-intl/server", ...)` at the top — Vitest's per-file hoisting means the override wins for that file.
- Two route-invoke helpers: `invokeRoute` for no-params handlers (`GET /api/organizations`), `invokeRouteWithParams<P>` for dynamic routes (`DELETE /api/projects/[projectId]`). The split exists because TypeScript's Promise variance rejects a single signature that accepts both — see JSDoc on `invoke-route.ts`.
- `beforeEach(() => truncateAll(prisma))` is **per-file**, not global — integration files opt in explicitly so a unit test that accidentally hits Prisma fails loudly instead of being masked by a silent truncate.

## Updating snapshots

### OpenAPI wire contract

```bash
UPDATE_OPENAPI=1 npm run test:contract
```

Regenerates `openapi.snapshot.json`. Review the JSON diff in the PR — any breaking change to the SDK wire format is explicit at review time, not discovered downstream.

### Email HTML inline snapshots

```bash
npx vitest run --project unit --update
```

Updates every `.toMatchInlineSnapshot(...)` whose expected value drifted. Used when a translation JSON file at `src/i18n/messages/<locale>/email-{otp,invite}.json` changes — the snapshot diff in the PR shows the rendered HTML delta side-by-side with the JSON edit.
