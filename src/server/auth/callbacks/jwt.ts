import "server-only";
import type { NextAuthConfig } from "next-auth";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { prisma } from "@/server/db/client";

type AuthCallbacks = NonNullable<NextAuthConfig["callbacks"]>;
type JwtCallback = NonNullable<AuthCallbacks["jwt"]>;

/**
 * Two branches: initial sign-in writes id+email; subsequent sign-in or `update()`
 * re-resolves name/image/locale/active-org from the DB — drives avatar refresh and
 * org switching without a full sign-out. Active-org chain: persisted →
 * validate membership → fall back to Personal Space (every user has one, from the
 * `createUser` event). `token.picture` is the OIDC standard claim; Auth.js maps it
 * onto `session.user.image`.
 */
export const jwtCallback: JwtCallback = async ({ token, user, trigger }) => {
  if (user?.id) {
    token.id = user.id;
    token.email = user.email;
  }

  if (!user?.id && trigger !== "update") {
    return token;
  }

  // Defensive bail — both branches above guarantee `token.id`, but a malformed
  // JWT landing here shouldn't crash on `findUnique`.
  const userId = token.id;
  if (!userId) return token;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true, activeOrganizationId: true, locale: true },
  });

  if (dbUser) {
    token.name = dbUser.name;
    token.picture = dbUser.image;
    // Travels untouched to the session callback, which narrows via `hasLocale` —
    // a stale value can't escape downstream as a bogus `Locale`.
    token.locale = dbUser.locale;
  } else if (user) {
    token.name = user.name;
    token.picture = user.image;
    // DB row vanished mid-session — set a default so the session projection
    // has something to narrow.
    token.locale = DEFAULT_LOCALE;
  }

  let activeOrgId = dbUser?.activeOrganizationId ?? null;

  if (activeOrgId) {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: activeOrgId,
        },
      },
    });
    if (!membership) activeOrgId = null;
  }

  if (!activeOrgId) {
    const personal = await prisma.organization.findFirst({
      where: { createdById: userId, type: "PERSONAL" },
    });
    activeOrgId = personal?.id ?? null;

    if (activeOrgId) {
      await prisma.user.update({
        where: { id: userId },
        data: { activeOrganizationId: activeOrgId },
      });
    }
  }

  token.activeOrganizationId = activeOrgId;

  return token;
};
