import "server-only";

import { headers as nextHeaders } from "next/headers";

import { getAppUrl } from "@/server/app-url";
import type { ApiFetchServerBridge } from "./fetch";

/**
 * Server-side augmentation for {@link apiFetch} when a Server Component
 * calls it with a relative URL (e.g. `/api/tracked-users`).
 *
 * @remarks
 * Two concerns that only apply on the server path:
 *
 *   1. **Absolute URL resolution.** Node.js `fetch` rejects relative
 *      URLs (`TypeError: Failed to parse URL from /api/foo`), unlike
 *      the browser which resolves against `window.location`. We
 *      prepend the app's base URL from {@link getAppUrl}.
 *
 *   2. **Cookie forwarding.** The outgoing self-call goes through the
 *      full Next.js pipeline — `proxy.ts` → `withAuth` → `auth()` —
 *      and Auth.js reads its JWT from cookies. Without the incoming
 *      request's `Cookie` header propagated, the route handler sees
 *      an anonymous caller and returns 401. We copy it from
 *      `nextHeaders()` when the caller hasn't supplied one
 *      explicitly.
 *
 * **Registration pattern (why this file isn't imported by `fetch.ts`).**
 * Turbopack walks dynamic `import()` targets for graph membership.
 * If `fetch.ts` dynamic-imported this module, the `next/headers`
 * reference would reach the Client Component SSR graph (via any
 * `"use client"` file that calls `apiFetch`), and Next.js fails the
 * build with *"'next/headers' is only available in Server Components"*.
 * To avoid any static reference from the client side, this module
 * self-registers `resolveServerFetchInit` on
 * `globalThis.__apiFetchServerBridge` at load time, and `fetch.ts`
 * reads it by name. The module is imported for its side-effect from
 * `src/app/[locale]/layout.tsx` — a pure Server Component — so the
 * entire server-only chain stays out of every client bundle.
 *
 * Registration is idempotent (reassignment to the same reference is a
 * no-op for all practical purposes) and runs before any page-level
 * Server Component can call `apiFetch`, because the root layout is
 * evaluated first in the App Router render pipeline.
 *
 * @see src/api-client/fetch.ts — consumer + `globalThis` shape.
 * @see src/app/[locale]/layout.tsx — side-effect importer.
 * @see src/server/env.ts — `APP_URL` / `VERCEL_URL` schema.
 */
const resolveServerFetchInit: ApiFetchServerBridge = async (url, init) => {
  const baseUrl = getAppUrl();
  const absoluteUrl = `${baseUrl}${url}`;

  const headers = new Headers(init?.headers);

  // Only reach into request context when the caller hasn't already
  // supplied a Cookie header. Background jobs or fire-and-forget
  // server code can thus pass their own (empty or synthetic) cookie
  // and skip the `nextHeaders()` call, which would throw outside a
  // request scope.
  if (!headers.has("cookie")) {
    const incoming = await nextHeaders();
    const cookieHeader = incoming.get("cookie");
    if (cookieHeader) headers.set("cookie", cookieHeader);
  }

  return { url: absoluteUrl, init: { ...init, headers } };
};

globalThis.__apiFetchServerBridge = resolveServerFetchInit;
