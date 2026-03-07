import { withAuth } from "@/app/api/_lib/with-auth";
import type { ApiKeyPlaintext } from "@/lib/mask-api-key";
import { projectKeySchema } from "@/api-client/projects/response-schemas";
import { requireProjectMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { NextResponse } from "next/server";

type Params = { projectId: string };

/**
 * `GET /api/projects/[projectId]/key` — fetch plaintext API key for copy-to-clipboard.
 *
 * OWNER-only. The full `dp_*` value leaves the server only here.
 *
 * @remarks
 * The entire key lifecycle (create / regenerate / copy / delete) is
 * concentrated under OWNER as a single governance surface. Admins
 * and viewers only see the masked preview from `GET /api/projects`
 * and cannot exfiltrate the raw token used for ingest.
 *
 * `Cache-Control: no-store` prevents intermediate proxies or the
 * client React Query cache from persisting the plaintext.
 */
export const GET = withAuth<Params>(async (req, user, { projectId }) => {
  await requireProjectMember(user.id, projectId, "OWNER");

  const { key } = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { key: true },
  });

  // The sole endpoint that deliberately exfiltrates the plaintext key.
  // Brand the response body so any future server-side transformation
  // over this payload has to reckon with the type (e.g. if someone
  // accidentally wires this into a cached loader, the brand + the
  // `no-store` header below both scream).
  return NextResponse.json(projectKeySchema.parse({ key: key as ApiKeyPlaintext }), {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
});
