import { withAuth } from "@/app/api/_lib/with-auth";
import { userAvatarResponseSchema } from "@/api-client/user/response-schemas";
import { userAvatarUrl } from "@/lib/avatar";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

/**
 * `POST /api/user/avatar` — regenerate the signed-in user's DiceBear avatar.
 *
 * @remarks
 * Rolls to a fresh UUID seed. Returns the new URL so the client can
 * update its avatar slot without a full profile refetch.
 */
export const POST = withAuth(async (req, user) => {
  const newImage = userAvatarUrl(randomUUID());

  await prisma.user.update({
    where: { id: user.id },
    data: { image: newImage },
  });

  log.info("user:avatar:regenerate:ok", { userId: user.id });

  return NextResponse.json(userAvatarResponseSchema.parse({ image: newImage }));
});
