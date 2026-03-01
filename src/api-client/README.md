# `src/api-client/`

Client-side API access layer. Every React Query call, every `fetch` to our own
`/api/*`, every client-side zod validator lives here. Symmetric counterpart of
`src/app/api/` (server routes) and `src/server/` (server-only code): server
emits routes, `api-client/` calls them.

## What belongs here

- **HTTP plumbing** — `fetch.ts` (`apiFetch`) and `error.ts` (`ApiError` with
  discriminated `kind`).
- **URL taxonomy** — `routes.ts`, a single source of truth for every
  `/api/*` path, consumed by queries and mutations alike.
- **Per-feature sub-folders** — one folder per logical entity
  (`organizations`, `projects`, `sessions`, `tracked-users`, `user`,
  `user-invites`). Each feature is self-contained:
  - `keys.ts` — hierarchical `queryOptions`-compatible key factory.
  - `queries.ts` — `queryOptions` factories + `useXxxQuery` hooks.
  - `mutations.ts` — `useXxxMutation` hooks.
  - `types.ts` — request / response DTOs that travel over HTTP.
  - `validators.ts` — zod schemas for request bodies (and optionally
    responses; reserved for boundary hardening when a feature earns it).
  - `constants.ts` — feature-scoped magic numbers (invite TTL, poll
    cadence, etc.) when they exist.
  - `domain.ts` — feature-scoped param primitives (sort options,
    date / activity ranges, poll cadences, pagination) grouped into
    sections. Substantive domain logic that earns its own file (e.g.
    `tracked-users/status.ts` for bucket derivation,
    `tracked-users/resolve-display-name.ts`, `sessions/updates.ts`
    for the snapshot-diff discriminated union) stays standalone.

- **Domain logic that is isomorphic** (server ↔ client) lives under
  `api-client/` because the code is client-safe by construction. The
  `tracked-users/status.ts` + `tracked-users/resolve-display-name.ts`
  pair is the canonical example — server route handlers import them
  via the usual module path, without `"server-only"`.

## What does NOT belong here

- **Server-side loaders.** Functions that read Prisma or require
  server-only state live in `src/server/` (e.g. `server/tracked-users.ts`).
  They return plain shapes that match `api-client` types, but the
  loader code itself cannot cross the boundary.
- **UI presentation tokens.** Tailwind class strings, label text,
  description copy belong colocated with the page that renders them
  (e.g. `src/app/(dashboard)/users/lib/status-ui.ts`). `api-client/`
  stays free of JSX and styling concerns.
- **Page-level UI state** (sorting, filtering, pagination URL state).
  That's `app/…/hooks/` territory; `api-client/` only knows how to
  transform those values into a request.

## Adding a new feature

1. `mkdir src/api-client/<feature>/`
2. Drop `keys.ts`, `queries.ts`, `mutations.ts`, `types.ts`,
   `validators.ts` following the shape of an existing feature (the
   `user` or `projects` folder is a small template; `tracked-users`
   is the full-size example).
3. Route the new paths via `src/api-client/routes.ts` — no raw
   string URLs elsewhere in the codebase.
4. Export a feature barrel from `<feature>/index.ts`.
5. Don't add to the top-level `api-client/index.ts` — per-feature
   imports tree-shake better and make the dependency graph obvious.

## Suspense vs classic query hooks

Every queryable entity ships **two** hook variants alongside the same
`queryOptions` factory:

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
`throwOnError: (_err, query) => query.state.data === undefined`, so
only genuine initial-load failures reach the boundary — background
polling flakes silently surface as toasts (via `QueryCache.onError`)
without tearing down the page.

## Invariants enforced by this layer

- **Zero raw `queryKey: [...]` arrays anywhere in `src/`.** Every
  key goes through the factory in `<feature>/keys.ts`.
  `@typescript-eslint/switch-exhaustiveness-check` + `assertNever`
  keep discriminated unions safe on the consumer side.
- **`ApiError.kind` is the narrowing axis, `status` is the raw code.**
  `classifyHttpStatus` runs once at the boundary; every downstream
  caller narrows on `err.kind`.
- **Auth-kind errors hard-navigate to sign-in.** Handled globally in
  `src/lib/query-client.ts` — individual mutations don't handle 401
  themselves.
- **Types cross the HTTP boundary as ISO strings**, not `Date`s.
  Every `createdAt` etc. in `types.ts` is `string`.
