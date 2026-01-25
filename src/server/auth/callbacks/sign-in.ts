import "server-only";
import { prisma } from "@/server/db/client";
import type { NextAuthConfig } from "next-auth";

type SignInCallback = NonNullable<NonNullable<NextAuthConfig["callbacks"]>["signIn"]>;

/**
 * `signIn` callback — gatekeeper that runs once per sign-in attempt.
 *
 * Side effect: when the user signs in via OAuth (Google / GitHub), the
 * provider has already verified the email, so we backfill `emailVerified`
 * if it's still null. We use `updateMany` (not `update`) because we need
 * `where: { ..., emailVerified: null }` — `update` requires a unique
 * filter and ignores extra conditions.
 *
 * Always returns `true` — we don't currently block any sign-ins here.
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
  return true;
};
