# Contributing

Kharko Dozor Dashboard is an open-source pet project with senior-level patterns as
an explicit goal. Contributions are welcome; PRs are reviewed on a best-effort
basis.

## Quick start

```bash
git clone https://github.com/kolia-zamnius/kharko-dozor-dashboard.git
cd kharko-dozor-dashboard
npm install
cp .env.example .env   # fill in auth, SMTP, DB URLs — see README
npx prisma generate    # auto-runs on install, but safe to re-run
npx prisma db push     # sync schema to your dev DB (or `migrate dev`)
npm run dev
```

Runs at [http://localhost:3000](http://localhost:3000). Sign in with email OTP
(any valid Gmail SMTP credentials work — the sender account doesn't need to
match the recipient).

### Scripts

| Command              | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Next.js dev server (Turbopack)                  |
| `npm run build`      | Production build — runs on every PR via CI      |
| `npm run lint`       | ESLint (type-aware rules on `.ts`/`.tsx`)       |
| `npm run type-check` | `tsc --noEmit` — strict + `noUncheckedIndexedAccess` |

CI runs all three on every PR plus caches `.next` between runs.

## Before you open a PR

Run these locally — CI will catch them otherwise, and iterating on a pushed PR
wastes everyone's time:

```bash
npm run lint && npm run type-check && npm run build
```

Smoke-test the flow you changed: sign-in, `/users` filter + pagination,
`/replays` playback, invite accept inside an org. The dashboard stays lightweight
enough that this takes a minute.

## Conventions

Short version of what reviewers will flag:

- **Feature-based folders.** `src/api-client/{feature}/` (client) mirrors
  `src/app/api/{feature}/` (server). Permission helpers + data loaders live in
  `src/server/`.
- **No raw `queryKey: [...]` arrays.** Every cache read / invalidate goes
  through hierarchical factories in `src/api-client/{feature}/keys.ts`.
- **No `any`, no `@ts-ignore`.** Type-aware ESLint catches floating promises,
  missing switch branches, and type-only imports. `as unknown as …` is
  acceptable **only** at a grep-able trust boundary with a WHY comment.
- **HttpError, not raw 500s.** Route handlers `throw new HttpError(status, msg)`;
  the `withAuth` / `withPublicKey` HOFs serialize to JSON responses. Zero
  `try/catch` in handler bodies.
- **RBAC double-validation.** If the UI hides a button, the API must also 403
  the corresponding mutation. `requireMember(user.id, orgId, minRole)` is the
  entry point.
- **Single loading gate per page.** Suspense + one page-level `<Spinner />`,
  `keepPreviousData` to avoid flicker on subsequent fetches.
- **JSDoc where intent isn't obvious.** Short file headers, WHY not WHAT, `@see`
  on anything that couples across modules.
- **Server-only stays server-only.** Every file in `src/server/` has
  `import "server-only"`; no server code leaks through `src/lib/` or
  `src/api-client/`.

## Commit messages

Conventional-ish — `type(scope): subject` on the first line, details below.
Recent history is a good template:

```
feat(api-client): useSuspenseQuery migration across page shells
refactor(pages): Block 5 — docs-forward polish + SeekBar perf fix
chore(deps): bump TS 6, Next 16.2.4, React 19.2.5, @types/node 25
```

Scopes roughly follow folder names: `api`, `api-client`, `server`, `pages`,
`ui`, `prisma`, `ci`, `deps`. One subject line ≤ 72 chars is a reasonable target;
the body can be as long as it needs to be.

## Database changes

Schema edits happen in `prisma/schema.prisma`. This project runs on
`prisma db push` only — there's no `prisma/migrations/` folder and PRs
do **not** commit migration files. Reason: the schema is the source of
truth, `db push` keeps every dev and the Neon production DB in sync
with it, and formal migrations would be infrastructure overhead we
don't need at the current stage.

```bash
npx prisma db push
```

Schema conventions are documented in `prisma/schema.prisma` itself via
`///` comments — match the surrounding style when you add new fields.
If a change needs a data backfill or is otherwise irreversible, flag
it in the PR description so reviewers can plan the production rollout
(the maintainer runs `db push` against Neon manually).

## Scope of contributions

Welcomed:

- Bug fixes.
- Improvements to existing patterns (spotted an inconsistency? flag it).
- Performance hot-path tightening.
- A11y fixes.
- Documentation — code comments and JSDoc updates that reflect real changes.

Please open an issue **before** a PR for:

- New features or new routes.
- Dependency additions.
- Refactors that touch more than ~20 files.
- Anything that changes the public shape of `/api/*` endpoints.

Out of scope (at least for now):

- Testing infrastructure (Vitest / Playwright setup) — being scoped separately.
- New locales beyond the six already shipped (`en`, `uk`, `de`, `es`, `pt`,
  `it`). Translation quality-improvement PRs for the first-pass MT locales
  (`de`, `es`, `pt`, `it`) are very welcome; net-new locales are not, until
  the existing ones have native-speaker review.
- PWA / offline support.
- Major visual identity / theme work — deliberately unpinned until the functional
  layer settles.

## Security issues

**Do not open a public issue for security bugs.** See
[`SECURITY.md`](./SECURITY.md) for the private-disclosure process.

## Code of conduct

Be kind. Disagree with ideas, not people. English or Ukrainian are both fine in
issues and PRs.
