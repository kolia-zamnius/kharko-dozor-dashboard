# `src/api-client/`

Client-side API access layer. Every React Query call, every `fetch` to our own
`/api/*`, every client-side zod validator lives here. Symmetric counterpart of
`src/app/api/` (server routes) and `src/server/` (server-only code): server
emits routes, `api-client/` calls them.

## Top-level layout

```
src/api-client/
  _lib/                          ← cross-cutting infrastructure (mirror of app/api/_lib/)
    fetch.ts                     ← apiFetch (generic JSON fetch + ApiError boundary)
    fetch-server-bridge.ts       ← server-only adapter; registers globalThis bridge
    error.ts                     ← ApiError + ApiErrorKind + classifyHttpStatus + isApiError
    routes.ts                    ← URL builder, single source of truth for /api/* paths
    polling.ts                   ← pollingOptions(ms) helper for staleTime/refetchInterval
    index.ts                     ← barrel
  <feature>/                     ← one folder per logical entity (uniform shape, see below)
  index.ts                       ← thin top-level barrel; re-exports `_lib` only
```

`_lib/` and feature folders are the only two kinds of top-level inhabitants.
No flat sibling files at the root — anything cross-cutting lives in `_lib/`.

## Per-feature canonical shape

Every feature folder follows the **same** layout. Deviations require justification.

```
<feature>/
  keys.ts                        ← hierarchical query-key factory
  schemas.ts                     ← zod schemas (request + response) + z.infer types
  queries.ts                     ← queryOptions factories + useXxxQuery + useXxxSuspenseQuery
  mutations.ts                   ← useXxxMutation hooks (use{Verb}{Resource}Mutation naming)
  constants.ts                   ← feature-scoped magic numbers (polling cadences, limits) — optional
  domain/                        ← isomorphic domain logic — optional, only when ≥2 modules
    <module>.ts
    index.ts                     ← barrel
  index.ts                       ← feature barrel; re-exports keys + queries + mutations + schemas + constants + domain
```

A feature folder with zero domain modules has no `domain.ts` and no
`domain/` subfolder. A feature with exactly one domain module keeps it as
`domain.ts` sibling. From two modules onward the rule is `domain/` subfolder
with a barrel — sibling files do not accumulate.

## What belongs here

- **HTTP plumbing** — `_lib/fetch.ts` and `_lib/error.ts`.
- **URL taxonomy** — `_lib/routes.ts`, the single source of truth for every `/api/*` path.
- **Per-feature data layer** — keys, schemas, queries, mutations, constants, domain.
- **Domain logic that is isomorphic** (server ↔ client) lives under
  `<feature>/domain/` because the code is client-safe by construction. The
  `tracked-users/domain/status.ts` + `tracked-users/domain/resolve-display-name.ts`
  pair is the canonical example — server route handlers import them via the
  usual module path, without `"server-only"`.

## What does NOT belong here

- **Server-side loaders.** Functions that read Prisma or require server-only
  state live in `src/server/` (e.g. `server/tracked-users.ts`). They return
  plain shapes that match `api-client` types, but the loader code itself
  cannot cross the boundary.
- **UI presentation tokens.** Tailwind class strings, label text, description
  copy belong colocated with the page that renders them (e.g.
  `src/app/(dashboard)/users/lib/status-ui.ts`). `api-client/` stays free of
  JSX and styling concerns.
- **Page-level UI state** (sorting, filtering, pagination URL state). That's
  `app/…/hooks/` territory; `api-client/` only knows how to transform those
  values into a request.

## Universal rules

These ten rules describe the shape every feature folder is expected to match.
They are invariants — drift is the bug, not the feature.

1. **One `schemas.ts` per feature.** Request schemas, response schemas, and
   every type derived from them (`export type X = z.infer<typeof xSchema>`)
   live in the same file. Hand-written URL-param types — same file, separate
   section. Schema is the source of truth; types follow.
2. **Every body-carrying mutation has a zod schema.** Even when no client-side
   pre-validation is wired, the schema documents the request shape and types
   the mutation hook input via `z.infer`.
3. **Both query hook twins, always.** Every `queryOptions` factory ships
   `use<X>Query` (classic) AND `use<X>SuspenseQuery` (suspense). Two lines
   each, single mental model. The cost is paid for uniformity even when one
   variant has no current consumer.
4. **Hierarchical keys.ts.** Baseline shape: `all() → lists() → list(params) →
   details() → detail(id)`. Sub-resources hang off `detail(id)` (e.g.
   `detail(id).sessions`, `detail(id).timeline`) — no synthetic prefix
   factories.
5. **Domain logic scaling.** Zero modules → no domain file. One module →
   `domain.ts` sibling. Two-plus modules → `domain/` subfolder with a barrel.
   The transition "one → two" creates the subfolder; siblings never accumulate.
6. **Mutation naming.** `use{Verb}{Resource}Mutation` — verb first, resource
   in the feature's own short terms, suffix always `Mutation`. Examples:
   `useCreateOrgMutation`, `useUpdateDisplayNameMutation`,
   `useRegenerateKeyMutation`. Never bury the verb mid-name.
7. **Pagination shape.** Cursor-based: request takes `cursor?: string`,
   response is `{ data: T[], nextCursor: string | null }`. List queries set
   `placeholderData: keepPreviousData`. Shared types/helpers live in
   `_lib/pagination.ts` (introduced when the second feature adopts cursor
   pagination — keep it inline until then).
8. **Polling cadences in `constants.ts`.** Magic numbers for poll intervals,
   stale times, limits live in `<feature>/constants.ts` as named exports
   (`SESSIONS_LIST_POLL_MS`, `STATUS_POLL_INTERVAL_MS`). `domain.ts`/`domain/`
   stays pure isomorphic logic — no cadence numbers there.
9. **Barrel re-exports everything.** Every `<feature>/index.ts` re-exports
   `keys`, `queries`, `mutations`, `schemas`, plus `constants` and `domain`
   when present. No silently-missing modules.
10. **Top-level `api-client/index.ts` stays thin.** It re-exports only `_lib/`
    primitives. Per-feature consumers import from
    `@/api-client/<feature>` directly — tree-shaking sees one entry per
    feature instead of a fat top-level barrel.

## Suspense vs classic — when to use which

Both hook twins are exported (rule 3). Call sites pick:

- `useXxxQuery` — classic `useQuery`. Returns `{ data?: T, status, … }`.
  Use when: the caller can render something useful while `data` is
  `undefined` (global nav badges, the replay snapshot diff indicator,
  `enabled: false` conditional queries).
- `useXxxSuspenseQuery` — `useSuspenseQuery`. Returns `{ data: T, … }`.
  Use when: the caller is a page **shell** wrapped in `<Suspense>`.
  Loading state moves to the boundary (one page-level `<Spinner />`);
  error state bubbles to the nearest `error.tsx`.

The page-shell pattern is:

```tsx
export function SomeShell() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <SomeShellContent />
    </Suspense>
  );
}
function SomeShellContent() {
  const { data } = useSomethingSuspenseQuery();
  return <PureView data={data} />;
}
```

Error throwing respects context: `src/lib/query-client.ts` sets
`throwOnError: (_err, query) => query.state.data === undefined`, so only
genuine initial-load failures reach the boundary — background polling flakes
silently surface as toasts (via `QueryCache.onError`) without tearing down
the page.

## Adding a new feature

1. `mkdir src/api-client/<feature>/`
2. Drop `keys.ts`, `schemas.ts`, `queries.ts`, `mutations.ts` matching the
   shape of an existing feature. `organizations/` is a small template;
   `tracked-users/` is the full-size example with `domain/`.
3. Add `<feature>/constants.ts` if you need polling cadences or magic
   numbers; otherwise skip the file.
4. Route the new paths via `_lib/routes.ts` — no raw string URLs elsewhere
   in the codebase.
5. Export a feature barrel from `<feature>/index.ts` re-exporting every
   sibling module.
6. Don't add to the top-level `api-client/index.ts` — per-feature imports
   tree-shake better and make the dependency graph obvious.

## Invariants enforced by this layer

- **Zero raw `queryKey: [...]` arrays anywhere in `src/`.** Every key goes
  through the factory in `<feature>/keys.ts`.
  `@typescript-eslint/switch-exhaustiveness-check` + `assertNever` keep
  discriminated unions safe on the consumer side.
- **`ApiError.kind` is the narrowing axis, `status` is the raw code.**
  `classifyHttpStatus` runs once at the boundary; every downstream caller
  narrows on `err.kind`.
- **Auth-kind errors hard-navigate to sign-in.** Handled globally in
  `src/lib/query-client.ts` — individual mutations don't handle 401
  themselves.
- **Types cross the HTTP boundary as ISO strings**, not `Date`s. Every
  `createdAt` etc. in `schemas.ts` is `z.string()`.
