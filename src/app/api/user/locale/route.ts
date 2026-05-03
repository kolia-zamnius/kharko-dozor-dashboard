import { withAuth } from "@/app/api/_lib/with-auth";
import { updateLocaleSchema } from "@/api-client/user/validators";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";

/**
 * Server only writes — session refresh + URL swap are client-side in
 * `useUpdateLocaleMutation.onSuccess`: 204 → `session.update({})` (forces JWT
 * refresh, `jwt` callback re-reads `User.locale`) → `router.replace(pathname,
 * { locale })`. Bundling the three steps avoids an inconsistent intermediate UI.
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
