# `api/_lib/` — cross-route toolkit

Private folder (underscore prefix opts out of Next.js routing — see the
[Private Folders](https://nextjs.org/docs/app/building-your-application/routing/colocation#private-folders)
docs). Nothing here is a route handler. Everything here is imported from
**two or more** routes that live in sibling or cousin folders.

## Decision tree — where does a new helper belong?

```
Is it imported from routes in MORE THAN ONE top-level feature folder?
  (e.g. both `sessions/` and `tracked-users/`)
├── yes → api/_lib/            (cross-route, goes here)
└── no  → imported only from sibling routes inside ONE feature folder?
         ├── yes → api/<feature>/_helpers/  (folder-scoped)
         └── no  → inline in the route file (rule of 3: extract on 3rd use)
```

**Example boundary**:
[`parseLimitParam`](./pagination.ts) is used by `/api/sessions`,
`/api/tracked-users`, and `/api/tracked-users/[userId]/sessions` — three
different feature folders → `_lib/`. By contrast,
[`enrichTrackedUser`](../tracked-users/_helpers/enrich.ts) is only used
inside `/api/tracked-users` → `_helpers/` (sibling scope).

## What's in this folder

| File                                           | What it exports                                                                              | One-line purpose                                                                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`with-auth.ts`](./with-auth.ts)               | `withAuth<P>` HOF, `SessionUser`                                                             | Session auth guard + `HttpError`/`ZodError` boundary for route handlers.                                                                             |
| [`with-public-key.ts`](./with-public-key.ts)   | `withPublicKey` HOF                                                                          | Twin of `withAuth` for SDK-facing endpoints that auth via `X-Dozor-Public-Key` instead of a session. Decorates responses with CORS.                  |
| [`constants.ts`](./constants.ts)               | `DEFAULT_PAGE_LIMIT`, `MAX_PAGE_LIMIT`, `MAX_TOP_PAGES_PER_BUCKET`                            | Server-only API constants. Cross-boundary constants (invite TTL, online threshold, session retention) live in `src/api-client/**` (feature `domain.ts` / `constants.ts`) or `src/lib/time.ts` instead so clients can import them too. |
| [`pagination.ts`](./pagination.ts)             | `parseLimitParam`, `buildCursorResponse`                                                     | Clamp `?limit=` into `[1, MAX_PAGE_LIMIT]`; fold `take: limit + 1` rows into canonical `{ data, nextCursor }`.                                       |
| [`cors.ts`](./cors.ts)                         | `PUBLIC_KEY_CORS_HEADERS`, `corsPreflightResponse`, `addCorsHeaders`                         | CORS primitives for public-key endpoints. Consumed by `with-public-key.ts`.                                                                          |
| [`invite-lifecycle.ts`](./invite-lifecycle.ts) | `expireStaleInvites`, `assertInviteUsableForUser`, `loadPendingOrgInvite`                    | Shared invariants + fire-and-forget lazy expiry for the `Invite` row lifecycle. Used by admin-side + user-side invite routes.                        |

## Conventions

- **One concept per file.** If a new helper doesn't fit any of the files
  above, create a new one rather than overloading an existing module.
- **`import "server-only";`** on every file — these must never end up in a
  client bundle.
- **No barrel `index.ts`**. Routes import from the full path
  (`@/app/api/_lib/with-auth`) — keeps source grep-friendly and matches
  the project-wide convention.
- **TSDoc on every export**: one-line summary, `@remarks` for non-obvious
  design decisions, `@param` / `@returns` / `@throws` without `{type}`
  annotations (TS already knows the types).
- **Time primitives live in `src/lib/time.ts`**, not here — they're used
  on both sides of the server/client boundary and need to stay
  client-safe.

## When to promote a helper from `_helpers/` to `_lib/`

Rule of thumb: once a second feature folder starts importing it. Until
then, leaving it folder-scoped keeps the cross-feature API surface
minimal and the per-feature ownership clear.
