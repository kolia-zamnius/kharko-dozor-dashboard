/**
 * TanStack Query composition root. Five cross-cutting concerns in one place:
 *  1. Global toast pipeline — every mutation success/error funnels through `sonner`.
 *  2. Auth-kind auto-redirect to `/sign-in` (preserves `callbackUrl`).
 *  3. Kind-aware retry — server/network up to 2x, rate-limit 1x, never auth/4xx.
 *  4. Suspense-aware `throwOnError` — only throws on initial-load failures (no
 *     cached data); a flaky polling tick won't crash a stale-but-valid view.
 *  5. Server: fresh client per request (no cache leak between users). Browser:
 *     module-scoped singleton (Suspense retries + nav must reuse the cache).
 *
 * Mutation `meta` shape lives in {@link src/types/tanstack-query.d.ts}.
 */

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { TranslationValues } from "next-intl";
import { toast } from "sonner";

import { isApiError, type ApiErrorKind } from "@/api-client/error";
import { translate, type MessageKey } from "@/i18n/imperative-translator";

/**
 * Returns `null` when the mutation didn't carry a key — caller suppresses the toast
 * rather than emitting an empty one. Function form lets a single mutation hook serve
 * static and variables-dependent copy without wiring `onSuccess` per call site.
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
 * TanStack default `retry: 3` is kind-blind — retrying a 401 is pointless. We narrow:
 * server/network up to 2x (transient — cold lambda, deploy rollover), rate-limit 1x
 * (server already sent `Retry-After`), everything else 0x. Non-`ApiError` failures
 * (zod parse, programmer errors) deterministic — no retry.
 */
const RETRYABLE_KINDS: ReadonlySet<ApiErrorKind> = new Set(["server", "network", "rate-limit"]);

function queryRetryPolicy(failureCount: number, error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (!RETRYABLE_KINDS.has(error.kind)) return false;
  const max = error.kind === "rate-limit" ? 1 : 2;
  return failureCount < max;
}

/**
 * Server no-op (no `window`). Already on auth pages — no-op (don't loop). Hard nav
 * because this lives outside React (no router hook); also wanted: cancels in-flight
 * queries and resets the cache.
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
        // Throw only on initial-load failures (no cached data). Background polling
        // failures stay silent — a flaky tick shouldn't crash a stale-but-valid view.
        // Auth-kind errors already redirect via QueryCache.onError, so they skip this.
        throwOnError: (_error, query) => query.state.data === undefined,
      },
      mutations: {
        // User-initiated → owner-controlled retry. Zero silent retries.
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (isApiError(error) && error.kind === "auth") {
          redirectToSignIn();
          return;
        }
        // Toast only on background refetch (data already cached). Initial-load
        // errors surface via the query's isError branch.
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
        // Specific server message wins over `meta.errorKey` — keeps "An invite is
        // already pending" instead of degrading to a generic "Failed to send invite".
        // Chain: HttpError → withAuth serializes to `{ error }` JSON → apiFetch
        // throws ApiError with that message → here.
        const serverMessage = isApiError(error) ? error.message : null;
        const fallback = resolveMutationMessage(mutation.meta?.errorKey, mutation.meta?.errorVars, variables);
        const toastMessage = serverMessage ?? fallback;
        if (toastMessage) toast.error(toastMessage);
        console.error("[mutation error]", error);
      },
      onSuccess: (_data, variables, _context, mutation) => {
        const msg = resolveMutationMessage(mutation.meta?.successKey, mutation.meta?.successVars, variables);
        if (msg) toast.success(msg);
      },
    }),
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Server: fresh client per call (no cache leak between concurrent renders).
 * Browser: module-scoped singleton (cache must survive Suspense retries + nav).
 */
export function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
