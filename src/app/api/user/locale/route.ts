import { withAuth } from "@/app/api/_lib/with-auth";
import { updateLocaleSchema } from "@/api-client/user/validators";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";

/**
 * `PATCH /api/user/locale` — persist the signed-in user's locale preference.
 *
 * @remarks
 * Validates against the canonical `LOCALES` tuple via `updateLocaleSchema`
 * — a client that sends a locale the server doesn't recognise gets a 400
 * instead of a silent write.
 *
 * Session refresh is intentionally handled client-side:
 *
 *   1. This endpoint updates `User.locale` and returns 204.
 *   2. The client calls `session.update({})` which forces a JWT refresh;
 *      the `jwt` callback re-reads `user.locale` from the DB and updates
 *      `token.locale`; the `session` callback narrows it into
 *      `session.user.locale`.
 *   3. The client then calls typed `router.replace(pathname, { locale })`
 *      to swap the URL prefix and re-render the whole tree in the new
 *      locale.
 *
 * All three steps happen inside the `useUpdateLocaleMutation`
 * `onSuccess` callback so the UI never sees an inconsistent state.
 *
 * @see src/api-client/user/mutations.ts::useUpdateLocaleMutation — consumer.
 * @see src/server/auth/callbacks/jwt.ts — re-reads `locale` on refresh.
 */
export const PATCH = withAuth(async (req, user) => {
  const body = updateLocaleSchema.parse(await req.json());

  await prisma.user.update({
    where: { id: user.id },
    data: { locale: body.locale },
  });

  log.info("user:locale:change:ok", { userId: user.id, locale: body.locale });

  return new Response(null, { status: 204 });
});
