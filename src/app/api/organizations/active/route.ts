import { withAuth } from "@/app/api/_lib/with-auth";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";
import { z } from "zod";

const switchOrgSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
});

/**
 * Membership check + update in one tx — the active-org pointer can never flip
 * to an org the caller isn't a member of, even under a concurrent
 * "remove member" race. Mirrored into the JWT so subsequent calls see the
 * new scope immediately.
 */
export const PATCH = withAuth(async (req, user) => {
  const { organizationId } = switchOrgSchema.parse(await req.json());

  await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });

    if (!membership) {
      throw new HttpError(403, "Not a member of this organization");
    }

    await tx.user.update({
      where: { id: user.id },
      data: { activeOrganizationId: organizationId },
    });
  });

  log.info("org:active:switch:ok", {
    userId: user.id,
    fromOrgId: user.activeOrganizationId ?? null,
    toOrgId: organizationId,
  });

  return new Response(null, { status: 204 });
});
