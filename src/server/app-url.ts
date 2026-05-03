import "server-only";

import { env } from "@/server/env";

/**
 * Resolution: explicit `APP_URL` → `VERCEL_URL` (auto-injected per deployment as a
 * bare hostname, so prepend `https://`) → localhost dev fallback. No trailing slash.
 */
export function getAppUrl(): string {
  if (env.APP_URL) return env.APP_URL;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}
