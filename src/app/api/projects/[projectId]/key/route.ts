import { withAuth } from "@/app/api/_lib/with-auth";
import type { ApiKeyPlaintext } from "@/lib/mask-api-key";
import { projectKeySchema } from "@/api-client/projects/response-schemas";
import { requireProjectMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";

type Params = { projectId: string };

/**
 * The ONLY route that returns plaintext `dp_*`. OWNER-only, `no-store` so
 * neither proxies nor the React Query cache persist it. Hit on copy-button
 * onClick — never threaded through `queryOptions`.
 */
export const GET = withAuth<Params>(async (req, user, { projectId }) => {
  await requireProjectMember(user.id, projectId, "OWNER");

  const { key } = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { key: true },
  });

  // Audit — actor + projectId only. The `key` field is also in pino's prod redact list as defence-in-depth.
  log.info("project:key:fetch:ok", { projectId, byUserId: user.id });

  return NextResponse.json(projectKeySchema.parse({ key: key as ApiKeyPlaintext }), {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
});
