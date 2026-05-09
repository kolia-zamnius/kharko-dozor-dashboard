import { withAuth } from "@/app/api/_lib/with-auth";
import { maskApiKey, type ApiKeyPlaintext } from "@/lib/mask-api-key";
import { projectSchema } from "@/api-client/projects/schemas";
import { generateApiKey } from "@/server/generate-api-key";
import { requireProjectMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";

type Params = { projectId: string };

/**
 * Atomic — old key invalidates on success, no grace window. Response is
 * masked-only so plaintext stays out of the React Query cache.
 */
export const POST = withAuth<Params>(async (req, user, { projectId }) => {
  await requireProjectMember(user.id, projectId, "OWNER");

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { key: generateApiKey(), lastUsedAt: null },
    select: {
      id: true,
      name: true,
      key: true,
      organizationId: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { sessions: true } },
    },
  });

  log.info("project:key:regenerate:ok", {
    projectId,
    orgId: updated.organizationId,
    byUserId: user.id,
  });

  return NextResponse.json(
    projectSchema.parse({
      id: updated.id,
      name: updated.name,
      maskedKey: maskApiKey(updated.key as ApiKeyPlaintext),
      organizationId: updated.organizationId,
      sessionCount: updated._count.sessions,
      lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }),
  );
});
