import "server-only";
import type { NextAuthConfig } from "next-auth";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { prisma } from "@/server/db/client";

// Auth.js types `callbacks` and `callbacks.jwt` as independently optional.
// The chained `NonNullable<>` strips both layers so the callback shape
// `({ token, user, trigger }) => Promise<JWT>` can be exported with the
// exact signature Auth.js expects to receive.
type AuthCallbacks = NonNullable<NextAuthConfig["callbacks"]>;
type JwtCallback = NonNullable<AuthCallbacks["jwt"]>;

/**
 * `jwt` callback — runs on every token read/write.
 *
 * Two distinct branches:
 *
 *  1. **Initial sign-in** (`user` present): copy `id` and `email` onto the
 *     token. These are stable for the session's lifetime.
 *
 *  2. **Sign-in OR explicit `update()` from the client** (`user.id` present
 *     OR `trigger === "update"`): re-resolve `name`, `image`, and active
 *     organization from the DB. This is how the avatar dropdown picks up
 *     a fresh avatar after the user clicks "regenerate", and how the org
 *     switcher reflects a newly-created org without a full sign-out.
 *
 *     Active-org resolution has three steps:
 *       a. Use the persisted `User.activeOrganizationId` if any.
 *       b. Validate the membership still exists — if the user was removed
 *          from that org since their last token write, fall through.
 *       c. Otherwise pick the user's Personal Space (every user has one,
 *          provisioned by the `createUser` event) and persist it back to
 *          `User.activeOrganizationId` so subsequent reads short-circuit.
 *
 * Note: we write `token.picture` (not `token.image`) — `picture` is the
 * standard OIDC claim name and Auth.js maps `session.user.image` from it.
 */
export const jwtCallback: JwtCallback = async ({ token, user, trigger }) => {
  if (user?.id) {
    token.id = user.id;
    token.email = user.email;
  }

  if (!user?.id && trigger !== "update") {
    return token;
  }

  // Both branches above guarantee `token.id` is set: initial sign-in
  // writes it from `user.id` two lines up; an `update` trigger only
  // fires after a sign-in already populated the token. Falling here
  // would mean a malformed JWT — bail rather than crash on `findUnique`.
  const userId = token.id;
  if (!userId) return token;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true, activeOrganizationId: true, locale: true },
  });

  if (dbUser) {
    token.name = dbUser.name;
    token.picture = dbUser.image;
    // `locale` travels on the token untouched — the session callback
    // narrows it through `hasLocale` before exposing to consumers, so
    // a stale value in the DB can't escape as a bogus `Locale`.
    token.locale = dbUser.locale;
  } else if (user) {
    token.name = user.name;
    token.picture = user.image;
    // DB row vanished between sign-in and this callback (rare —
    // deleted mid-session). Default rather than leaving `token.locale`
    // unset so the session projection has something to narrow.
    token.locale = DEFAULT_LOCALE;
  }

  let activeOrgId = dbUser?.activeOrganizationId ?? null;

  // Validate membership — if user is no longer a member, fall back to personal org.
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
