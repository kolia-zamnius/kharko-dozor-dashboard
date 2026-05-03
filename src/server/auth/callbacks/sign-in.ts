import "server-only";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";
import type { NextAuthConfig } from "next-auth";

type SignInCallback = NonNullable<NonNullable<NextAuthConfig["callbacks"]>["signIn"]>;

/**
 * OAuth providers verify the email — backfill `emailVerified` if still null.
 * `updateMany` (not `update`) because the where clause needs `emailVerified: null`,
 * which Prisma's `update` ignores when paired with a unique id filter.
 */
export const signInCallback: SignInCallback = async ({ user, account }) => {
  if (account?.type === "oidc" || account?.type === "oauth") {
    if (user?.id) {
      await prisma.user.updateMany({
        where: { id: user.id, emailVerified: null },
        data: { emailVerified: new Date() },
      });
    }
  }

  log.info("auth:signin:callback:ok", {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    provider: account?.provider ?? null,
    type: account?.type ?? null,
  });

  return true;
};
