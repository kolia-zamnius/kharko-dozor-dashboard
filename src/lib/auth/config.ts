import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Edge-safe auth config — no Prisma, no adapter.
 * Used by proxy.ts (Next.js 16 middleware replacement).
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
