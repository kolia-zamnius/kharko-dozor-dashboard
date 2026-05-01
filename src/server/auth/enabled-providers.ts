import "server-only";
import type { EnabledProviders } from "@/lib/auth/enabled-providers.types";
import { env } from "@/server/env";

/**
 * Derive provider availability from validated env. Pure function — safe
 * to call repeatedly; `env` is already a frozen object on import.
 *
 * @remarks
 * Self-hosters opt into individual providers by setting their env vars —
 * a missing var pair means the provider isn't available, the FE doesn't
 * render its button, and `createAuthProviders()` doesn't register it
 * with Auth.js. This keeps a single source of truth (env state) and
 * avoids "button shows but click crashes" UX gaps.
 *
 * The boot-time refine in `env.ts` guarantees at least one of `google`,
 * `github`, or `otp` is `true` — consumers can rely on that joint
 * invariant.
 *
 * @returns Boolean flags per primary provider, plus the always-true
 *   `passkey` flag for symmetry at call sites.
 *
 * @see src/lib/auth/enabled-providers.types.ts — client-safe type.
 */
export function getEnabledProviders(): EnabledProviders {
  return {
    google: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    github: Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET),
    otp: Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD),
    passkey: true,
  };
}
