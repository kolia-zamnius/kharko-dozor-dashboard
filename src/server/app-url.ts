import "server-only";

import { env } from "@/server/env";

/**
 * Absolute base URL of the running app — no trailing slash.
 *
 * @remarks
 * Resolution order:
 *
 *   1. `APP_URL` — explicit override. Recommended for every
 *      environment (local `.env`, preview, production) because it's
 *      the only source that reflects the author's intent.
 *   2. `VERCEL_URL` — auto-injected per Vercel deployment. Covers the
 *      default Vercel pipeline without any manual env setup.
 *   3. `http://localhost:3000` — last-resort dev fallback.
 *
 * Consumed anywhere that needs to build an absolute URL against the
 * running app: `apiFetch` server-side self-calls, canonical/hreflang
 * metadata, `sitemap.xml`, `robots.txt`, OpenGraph image routes.
 * Centralising the fallback chain here means flipping hosts is a
 * single-line change.
 *
 * @see src/api-client/fetch-server-bridge.ts — consumer for server
 *   self-fetch prefix resolution.
 * @see src/app/robots.ts + src/app/sitemap.ts + `(marketing)/page.tsx`
 *   — consumers for SEO / sharing metadata.
 */
export function getAppUrl(): string {
  if (env.APP_URL) return env.APP_URL;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}
