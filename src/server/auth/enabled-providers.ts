import type { EnabledProviders } from "@/lib/auth/enabled-providers";
import { env } from "@/server/env";
import "server-only";

/**
 * Provider availability from validated env. Missing var pair → button hidden in
 * the UI and provider not registered with Auth.js (avoids the "button shows but
 * click crashes" gap for self-hosters who skip a provider). Boot-time refine in
 * `env.ts` guarantees at least one of `google` / `github` / `otp` is true.
 * Passkey is always on — it's an add-on registered from Settings, not an
 * account-creation path.
 */
export function getEnabledProviders(): EnabledProviders {
  return {
    google: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    github: Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET),
    otp: Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD),
    passkey: true,
  };
}
