# Contributing

Dozor Dashboard is an open-source pet project with senior-level patterns as
an explicit goal. Contributions are welcome; PRs are reviewed on a best-effort
basis.

## Conventions, scripts, commit messages, database workflow

All in the docs:

- [**Resources → Contributing**](https://kharko-dozor.vercel.app/documentation/resources/contributing) — quick start, scripts, conventions reviewers will flag, commit / PR shape, database changes.
- [**Resources → Architecture**](https://kharko-dozor.vercel.app/documentation/resources/architecture) — design intent behind the constraints (HOFs, RBAC, feature folders, single-loading-gate, etc.).

The docs live in the repo at `src/app/(docs)/documentation/_content/` — the same Markdown files render on the docs site and are reviewable in PR diffs.

## Quick start

```bash
git clone https://github.com/kolia-zamnius/kharko-dozor-dashboard.git
cd kharko-dozor-dashboard
npm install
cp .env.example .env       # fill in auth, SMTP, DB URLs
npx prisma migrate dev
npm run dev
```

Full env var explanation: [Self-hosting reference](https://kharko-dozor.vercel.app/documentation/resources/self-hosting-reference#environment-variables).

## Scope of contributions

Welcomed:

- Bug fixes.
- Improvements to existing patterns (spotted an inconsistency? flag it).
- Performance hot-path tightening.
- A11y fixes.
- Documentation — code comments, JSDoc updates, MDX edits that reflect real changes.

Please open an issue **before** a PR for:

- New features or new routes.
- Dependency additions.
- Refactors that touch more than ~20 files.
- Anything that changes the public shape of `/api/*` endpoints.

Out of scope (at least for now):

- Frontend tests (Playwright / RTL) — being scoped separately.
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
