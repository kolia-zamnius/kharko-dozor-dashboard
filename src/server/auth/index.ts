import "server-only";
import authConfig from "@/lib/auth/config";
import { createAuthAdapter } from "@/server/auth/adapter";
import { authCallbacks } from "@/server/auth/callbacks";
import { authEvents } from "@/server/auth/events";
import { createAuthProviders } from "@/server/auth/providers";
import { log } from "@/server/logger";
import NextAuth from "next-auth";

/**
 * Composition root for Auth.js — wires adapter / providers / callbacks / events
 * into the NextAuth factory. Edge twin lives at {@link src/lib/auth/config.ts}
 * (used by {@link src/proxy.ts} where Prisma can't run); spread first so this
 * file's keys win. The `logger.warn` filter mutes the per-request
 * `experimental-webauthn` notice so real warnings stand out.
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
      if (code !== "experimental-webauthn") {
        log.warn("auth:nextauth:warn", { code });
      }
    },
  },
});
