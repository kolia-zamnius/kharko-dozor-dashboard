import { ApiError, classifyHttpStatus } from "./error";

/**
 * Server-bridge function shape. Implemented in
 * `fetch-server-bridge.ts` (server-only) and registered on
 * `globalThis` at module-load time from a server-component import
 * chain (see `src/app/[locale]/layout.tsx`). `apiFetch` looks it up
 * by name instead of importing the module, so Turbopack doesn't pull
 * the server-only module (and its `next/headers` import) into the
 * Client Component SSR graph.
 */
export type ApiFetchServerBridge = (
  url: string,
  init: RequestInit | undefined,
) => Promise<{ url: string; init: RequestInit }>;

declare global {
  var __apiFetchServerBridge: ApiFetchServerBridge | undefined;
}

/**
 * Thin typed wrapper around `fetch` that every query/mutation goes through.
 *
 * @remarks
 * Responsibilities are intentionally narrow — this is plumbing, not a
 * full HTTP client:
 *
 *   1. Default `Content-Type: application/json` when a body is present
 *      (nearly every non-GET call) — the one header we auto-send,
 *      everything else is on the caller.
 *   2. On a non-OK response, read the error body (best-effort — a
 *      malformed payload collapses to `{}`) and throw a rich
 *      `ApiError` carrying `kind` (semantic category for narrowing),
 *      `status` (raw HTTP code for logging / retry-after / etc.), the
 *      server-supplied `message`, and `cause` chained back to the
 *      original network or parse error when we have one. See
 *      `error.ts` for the kind taxonomy.
 *   3. Return `undefined` on `204 No Content` without trying to parse
 *      the empty body — otherwise `res.json()` throws.
 *
 * **Cancellation.** Every caller MUST thread `init.signal` for in-
 * flight requests to be cancellable. TanStack Query v5 passes the
 * query's abort signal into `queryFn` — our `queryFn: ({ signal }) =>
 * apiFetch(url, { signal })` pattern is what lets the cache cancel
 * stale requests when a queryKey changes or a component unmounts.
 * Skipping the thread means an unmounted component's fetch keeps
 * running, resolves into nowhere, and in the worst case triggers a
 * warning when its setState lands in a torn-down tree.
 *
 * **Server-side self-call support.** Server Components can call
 * `apiFetch("/api/...")` through `queryClient.prefetchQuery(...)` to
 * hydrate the TanStack cache with initial data. Node.js `fetch`
 * rejects relative URLs (unlike the browser, which resolves against
 * `window.location`), and the outgoing self-call needs the incoming
 * request's `Cookie` header to re-authenticate against the route
 * handler's `withAuth` guard. Both concerns are handled by the
 * `server-only` bridge in `fetch-server-bridge.ts`. This file does
 * NOT import that module — Turbopack follows dynamic `import()` for
 * graph membership and would pull `next/headers` into the Client
 * Component SSR graph, which Next.js forbids. Instead the bridge
 * self-registers on `globalThis.__apiFetchServerBridge` when the
 * server imports it via `src/app/[locale]/layout.tsx` (a Server
 * Component — the import chain stays in the server-only graph).
 * `apiFetch` looks the function up by name at runtime; in the
 * browser the global is `undefined` and the server branch is
 * skipped entirely.
 *
 * Everything else — auth headers, retry logic, response validation —
 * is deliberately NOT here. Auth.js cookies ride the request
 * transparently; retries live at the TanStack layer in
 * `src/lib/query-client.ts` where they can read `ApiError.kind`;
 * runtime response validation would add a zod-per-call tax we
 * haven't needed.
 *
 * @throws {ApiError} on every non-OK response, network-level failure,
 *   or abort. Aborts surface as `kind: "network"` too (short-circuit
 *   path — caller typically won't see them because TanStack swallows
 *   the rejection for cancelled queries).
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let finalUrl = url;
  let finalInit: RequestInit | undefined = init;

  // Server path: resolve relative URL to absolute + forward Cookie so
  // the self-call hits `withAuth` with the caller's session. Read the
  // bridge off `globalThis` rather than importing it — see the module-
  // level docblock for why. On the client the global is always
  // `undefined` so this branch is a no-op.
  if (typeof window === "undefined" && url.startsWith("/")) {
    const bridge = globalThis.__apiFetchServerBridge;
    if (!bridge) {
      // Loud failure in place of the obscure
      // `TypeError: Failed to parse URL from /api/...` that Node's
      // `fetch` would raise a few lines below. If this fires, the
      // side-effect import from the root layout is missing or the
      // bridge module was tree-shaken.
      throw new Error(
        "apiFetch: server-side relative URL cannot be resolved — the " +
          "server-only bridge is not registered. Import " +
          "`@/api-client/fetch-server-bridge` as a side-effect from a " +
          "Server Component that's always in the render tree " +
          "(e.g. `src/app/[locale]/layout.tsx`).",
      );
    }
    const resolved = await bridge(url, init);
    finalUrl = resolved.url;
    finalInit = resolved.init;
  }

  const headers = new Headers(finalInit?.headers);
  if (finalInit?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(finalUrl, { ...finalInit, headers });
  } catch (cause) {
    // Rethrow aborts as-is — TanStack Query v5 recognises a native
    // `AbortError` thrown from `queryFn` and routes it through its
    // cancellation path (no retry, no `onError`, no toast). Wrapping
    // it in an `ApiError("network", ...)` would strip the `.name`
    // signal and leak the cancellation into the regular failure
    // pipeline, where the `network` retry policy would waste up to
    // two extra attempts against the already-aborted signal.
    //
    // `AbortError` is a `DOMException` in both browser and Node 18+.
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }

    // Genuine network-level failure — offline, DNS, CORS preflight.
    // No status, no body. Preserve the original error via `cause` so a
    // DevTools drill-down still reveals whether it was a DNS miss or a
    // CORS preflight failure.
    const message = cause instanceof Error ? cause.message : "Network error";
    throw new ApiError("network", 0, message, { cause });
  }

  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    const message = body.error || `Request failed (${res.status})`;
    throw new ApiError(classifyHttpStatus(res.status), res.status, message);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}
