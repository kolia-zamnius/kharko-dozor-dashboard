import "server-only";

import { env } from "@/server/env";

/**
 * Development-only structured log. Stripped to a no-op in production
 * so email addresses, flow markers, and other PII-adjacent trace
 * noise never reach hosted stdout.
 *
 * @remarks
 * Used across Server Actions (`actions/auth.ts`), Auth.js providers
 * (`server/auth/providers.ts`), and routes that fire fire-and-forget
 * emails (`/api/organizations/[orgId]/invites`) — anywhere we want
 * tag + payload tracing during `npm run dev` but need silent prod.
 *
 * The env check uses the zod-validated `env.NODE_ENV` rather than
 * `process.env.NODE_ENV` so the boundary is grep-able and type-safe.
 */
export function devLog(tag: string, data?: Record<string, unknown>): void {
  if (env.NODE_ENV !== "development") return;
  console.log(tag, data);
}
