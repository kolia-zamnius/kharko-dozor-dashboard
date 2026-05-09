import "server-only";

import { headers as nextHeaders } from "next/headers";

import { getAppUrl } from "@/server/app-url";
import type { ApiFetchServerBridge } from "./fetch";

/**
 * Self-registers on `globalThis.__apiFetchServerBridge` instead of being imported
 * by `fetch.ts` — a direct import would pull `next/headers` into the Client
 * Component SSR graph, which Next.js forbids. Side-effect-imported from
 * {@link src/app/layout.tsx} (the non-localised root).
 */
const resolveServerFetchInit: ApiFetchServerBridge = async (url, init) => {
  const baseUrl = getAppUrl();
  const absoluteUrl = `${baseUrl}${url}`;

  const headers = new Headers(init?.headers);

  // Skip `nextHeaders()` if caller supplied a cookie — background jobs run
  // outside a request scope where `nextHeaders()` throws.
  if (!headers.has("cookie")) {
    const incoming = await nextHeaders();
    const cookieHeader = incoming.get("cookie");
    if (cookieHeader) headers.set("cookie", cookieHeader);
  }

  return { url: absoluteUrl, init: { ...init, headers } };
};

globalThis.__apiFetchServerBridge = resolveServerFetchInit;
