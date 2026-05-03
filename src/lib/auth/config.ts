import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Edge-safe base — kept Node-API-free so it can spread into the full Node config
 * in {@link src/server/auth/index.ts} (which adds Prisma adapter, OTP, Passkey).
 */
export default {
  providers: [Google({ allowDangerousEmailAccountLinking: true }), GitHub({ allowDangerousEmailAccountLinking: true })],
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;
