/**
 * TanStack Query composition root.
 *
 * @remarks
 * Owns five cross-cutting concerns so they live in exactly one place:
 *
 *   1. Global `QueryCache.onError` / `MutationCache.onError` +
 *      `onSuccess` handlers — every mutation and every background
 *      refetch funnel errors through the same `sonner` toast pipeline,
 *      so hooks and call sites never plumb `onError` by hand.
 *   2. Auth-kind auto-redirect — when `ApiError.kind === "auth"`
 *      surfaces anywhere, we yank the user to `/sign-in` with the
 *      current URL preserved as `callbackUrl`. Without this, a stale
 *      session silently 401s and the UI shows confusing empty states.
 *   3. Kind-aware retry policy — queries retry only on transient
 *      failures (`server`, `network`, `rate-limit` once); mutations
 *      never retry (user-initiated → owner-controlled). See
 *      `queryRetryPolicy` below.
 *   4. Suspense-aware `throwOnError` — initial-load failures bubble
 *      to the nearest Next.js `error.tsx`; background polling
 *      failures do NOT, so a flaky tick doesn't crash a page full of
 *      valid-but-stale data to an error view.
 *   5. The client singleton pattern — server renders get a fresh
 *      `QueryClient` per request (so two concurrent renders can't
 *      share cache), browser reuses one across Suspense retries and
 *      client-side navigations.
 *
 * The `mutation.meta` shape that drives the toast pipeline is declared
 * in `src/types/tanstack-query.d.ts` (module augmentation). See that
 * file for why it lives at the root type level and not here.
 *
 * @see src/api-client/fetch.ts — where `ApiError` is thrown.
 * @see src/api-client/error.ts — discriminated `ApiErrorKind` taxonomy.
 */

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { TranslationValues } from "next-intl";
import { toast } from "sonner";

import { isApiError, type ApiErrorKind } from "@/api-client/error";
import { translate, type MessageKey } from "@/i18n/imperative-translator";

/**
 * Resolve a `mutation.meta.{success,error}Key` + `*Vars` pair into the
 * localised toast string.
 *
 * @remarks
 * Both `key` and `vars` accept either a plain value or a callback that
 * computes one from the mutation variables. This lets a single mutation
 * hook serve both static ("Passkey renamed") and variables-dependent
 * ("Joined ${orgName}") copy without losing the meta-level cross-cutting
 * wiring. A `null` return means the mutation didn't carry a key — the
 * caller suppresses the toast in that case rather than emitting an empty
 * one.
 */
function resolveMutationMessage(
  keyOrFn: MessageKey | ((variables: unknown) => MessageKey) | undefined,
  varsOrFn: TranslationValues | ((variables: unknown) => TranslationValues) | undefined,
  variables: unknown,
): string | null {
  if (!keyOrFn) return null;
  const key = typeof keyOrFn === "function" ? keyOrFn(variables) : keyOrFn;
  const vars = typeof varsOrFn === "function" ? varsOrFn(variables) : varsOrFn;
  return translate(key, vars);
}

/**
 * Per-kind retry policy for queries.
 *
 * @remarks
 * TanStack's default `retry: 3` is kind-blind — it retries a 401 as
 * eagerly as a 503, which is pointless (auth errors don't resolve by
 * retrying, the user isn't suddenly signed in; 4xx validation rejects
 * would return the same result). We narrow:
 *
 *   - **client-side errors (4xx except 408/429)** — never retry. The
 *     server already told us the input is wrong / not found / not
 *     allowed. Retrying only burns requests.
 *   - **rate-limit (429)** — retry ONCE with the library default
 *     delay; in practice the server sent `Retry-After` and a UI-level
 *     toast would tell the user to slow down anyway.
 *   - **server / network errors** — worth retrying up to 2 extra
 *     attempts. These are transient: a cold Lambda, a flaky
 *     connection, a deploy rollover.
 *   - **auth** — we redirect to `/sign-in` via the global error
 *     handler below, so a retry would race against navigation.
 *
 * Non-`ApiError` failures (thrown from zod parse, programmer errors)
 * are treated as deterministic — `retry: false`. Retrying them would
 * re-throw the same exception on the next attempt.
 */
const RETRYABLE_KINDS: ReadonlySet<ApiErrorKind> = new Set(["server", "network", "rate-limit"]);

function queryRetryPolicy(failureCount: number, error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (!RETRYABLE_KINDS.has(error.kind)) return false;
  // `rate-limit` earns one retry; server/network get the usual two.
  const max = error.kind === "rate-limit" ? 1 : 2;
  return failureCount < max;
}

/**
 * Redirect to `/sign-in?callbackUrl=...` when an auth-kind error surfaces.
 *
 * @remarks
 * No-ops on the server render (no `window`) and when already on an
 * unauthenticated route — a 401 fetched from `/sign-in` shouldn't loop
 * the user back there. Uses a hard `location.assign` rather than the
 * Next router because `query-client.ts` lives outside the React tree
 * and has no hook access; also, a full navigation is what we want
 * here so any in-flight queries are cancelled and the cache resets.
 */
function redirectToSignIn() {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) return;
  const callbackUrl = encodeURIComponent(pathname + search);
  window.location.assign(`/sign-in?callbackUrl=${callbackUrl}`);
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: queryRetryPolicy,
        staleTime: 60_000,
        // Suspense queries throw on error by default, which bubbles
        // the failure to the nearest Next.js `error.tsx`. Good on
        // first load (page fails → error page). BAD on background
        // polling (user is looking at stale-but-valid data, one
        // failed tick shouldn't crash the whole tree to an error
        // page). Narrow: only throw when there's no cached data to
        // fall back on — i.e. genuine initial-load failures.
        //
        // Auth-kind errors skip this entirely — they're caught in
        // `QueryCache.onError` above and hard-navigate to sign-in,
        // so we never reach the boundary.
        throwOnError: (_error, query) => query.state.data === undefined,
      },
      mutations: {
        // Mutations are user-initiated (Submit, Delete, Toggle). A
        // retry can double-write and the user has a clear mental
        // model of "I clicked, it failed, let me click again". Zero
        // silent retries.
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (isApiError(error) && error.kind === "auth") {
          redirectToSignIn();
          return;
        }
        // Toast only on background refetch failures (data already cached).
        // Initial-load errors are already surfaced via component isError state.
        if (query.state.data !== undefined) {
          toast.error(error.message);
        }
        console.error("[query error]", error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, _context, mutation) => {
        if (isApiError(error) && error.kind === "auth") {
          redirectToSignIn();
          return;
        }
        // Prefer the server-provided message over the generic
        // `meta.errorKey` hook label. Full chain:
        //
        //   1. Route handler throws `new HttpError(status, "descriptive")`.
        //   2. `withAuth` serialises it to `{ error: "descriptive" }` JSON
        //      with the correct HTTP status.
        //   3. `apiFetch` reads `body.error` and throws `new ApiError(
        //      kind, status, "descriptive")` — the specific message
        //      survives the HTTP boundary intact.
        //   4. Here we pull that specific message into the toast so the
        //      user sees "An invite is already pending for this email"
        //      instead of a generic "Failed to send invite".
        //
        // The `meta.errorKey` fallback still matters for network
        // failures (no response body, `apiFetch` throws a network-kind
        // `ApiError` with a terse message) and for mutations that want
        // a fixed localised label regardless of which backend error fired.
        const serverMessage = isApiError(error) ? error.message : null;
        const fallback = resolveMutationMessage(mutation.meta?.errorKey, mutation.meta?.errorVars, variables);
        const toastMessage = serverMessage ?? fallback;
        if (toastMessage) toast.error(toastMessage);
        console.error("[mutation error]", error);
      },
      onSuccess: (_data, variables, _context, mutation) => {
        // Resolve the success key + vars (each may be a callback of the
        // mutation variables). `null` means the mutation opted out of a
        // success toast — suppress instead of emitting an empty string.
        const msg = resolveMutationMessage(mutation.meta?.successKey, mutation.meta?.successVars, variables);
        if (msg) toast.success(msg);
      },
    }),
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Return a `QueryClient` appropriate for the current render environment.
 *
 * @remarks
 * Server: a fresh client every call — two concurrent requests must not
 * share a cache, otherwise user A's hydrated data could leak into user
 * B's HTML. Browser: a module-scoped singleton — the cache must survive
 * Suspense retries and client-side navigations, so every call returns
 * the same instance.
 */
export function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
