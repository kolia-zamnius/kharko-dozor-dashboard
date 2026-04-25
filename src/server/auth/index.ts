import "server-only";
import authConfig from "@/lib/auth/config";
import { createAuthAdapter } from "@/server/auth/adapter";
import { authCallbacks } from "@/server/auth/callbacks";
import { authEvents } from "@/server/auth/events";
import { createAuthProviders } from "@/server/auth/providers";
import { log } from "@/server/logger";
import NextAuth from "next-auth";

/**
 * Composition root for Auth.js. Every concern (adapter, providers,
 * callbacks, events) lives in its own file in `src/server/auth/`; this
 * file just wires them into the NextAuth factory.
 *
 * Two configs at play:
 *   - `lib/auth/config.ts` — edge-safe base (no Prisma) used by the
 *     `src/proxy.ts` middleware. Spread first so this file's keys win.
 *   - This file — Node-only superset with Prisma adapter, providers,
 *     callbacks, and events. Used by route handlers and Server Components.
 *
 * If you need to add a new provider, callback, or event handler, edit
 * the corresponding sibling file rather than inlining it here. Keeping
 * `index.ts` tiny means a quick scan tells you the full surface of the
 * auth subsystem at a glance.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: createAuthAdapter(),
  providers: createAuthProviders(),
  callbacks: authCallbacks,
  events: authEvents,
  experimental: {
    enableWebAuthn: true,
  },
  logger: {
    warn(code) {
      // The `experimental-webauthn` warning fires on every request and
      // adds nothing — silence it explicitly so real warnings stand out.
      if (code !== "experimental-webauthn") {
        log.warn("auth:nextauth:warn", { code });
      }
    },
  },
});
