"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";

import { getQueryClient } from "@/lib/query-client";

/**
 * Client providers scoped to the dashboard surface.
 *
 * @remarks
 * Lifted out of {@link ./stable.tsx} so the public marketing landing
 * doesn't pay their hydration cost. TanStack Query's runtime + Auth.js
 * `SessionProvider` together are ~40 KB of client JS that the
 * marketing tree has zero use for after the header CTA stopped
 * consuming the session — every visitor (anonymous or authed) sees the
 * same `Sign in` / `Get started` pair, and `proxy.ts` redirects authed
 * users away from `/sign-in` and `/sign-up` to the dashboard
 * (`src/proxy.ts` auth-pages branch). The auth route group is also
 * skipped here: `signIn` from `next-auth/react` is a plain function
 * that doesn't read provider context, and `toast()` from sonner
 * relies on its own module-scoped store, so the auth pages render
 * fine against the root `<Toaster>` alone.
 *
 * Mounted from `(dashboard)/layout.tsx` only — every dashboard page
 * uses `useSuspenseQuery` and reads session client-side somewhere in
 * its tree. Keeping the providers at the route-group boundary means a
 * locale change inside the dashboard (`/en/users` → `/uk/users`)
 * preserves the same layout instance, so the query cache and session
 * state survive the navigation. Cross-group transitions
 * (`/sign-in` ↔ `/users`) typically flow through Auth.js `signIn` /
 * `signOut`, which trigger a full reload — re-mounting these
 * providers there is a no-op cost.
 *
 * `getQueryClient()` returns a fresh client per server render and a
 * module-scoped singleton on the browser, so consecutive client
 * navigations within the dashboard share the cache.
 *
 * @see src/app/_providers/stable.tsx — Theme + Toaster (used by every
 *   surface, locale-stable).
 * @see src/lib/query-client.ts — `QueryClient` factory + global
 *   error / mutation toast pipeline.
 */
export function SessionQueryProviders({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
