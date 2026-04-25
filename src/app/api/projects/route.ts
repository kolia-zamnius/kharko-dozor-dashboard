import { withAuth } from "@/app/api/_lib/with-auth";
import { maskApiKey, type ApiKeyPlaintext } from "@/lib/mask-api-key";
import { projectListSchema, projectSchema } from "@/api-client/projects/response-schemas";
import { createProjectSchema } from "@/api-client/projects/validators";
import { generateApiKey } from "@/server/generate-api-key";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";

/**
 * `GET /api/projects` — list projects across every org the caller belongs to.
 *
 * @remarks
 * Optional `?organizationId=` narrows to one org (used by the
 * settings panel's API-keys section). Rows carry **masked** keys
 * only — plaintext never leaves `GET /api/projects/[id]/key`.
 * Ordered `createdAt DESC` so newest projects surface first.
 *
 * @see {@link projectsListOptions} — client-side consumer.
 */
export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("organizationId");

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, ...(organizationId ? { organizationId } : {}) },
    select: { organizationId: true },
  });

  if (memberships.length === 0) {
    return NextResponse.json(projectListSchema.parse([]));
  }

  const orgIds = memberships.map((m) => m.organizationId);

  const projects = await prisma.project.findMany({
    where: { organizationId: { in: orgIds } },
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
    orderBy: { createdAt: "desc" },
  });

  const data = projects.map((p) => ({
    id: p.id,
    name: p.name,
    // Trust boundary: `p.key` is a string from Prisma that we know was
    // minted by `generateApiKey` — promote it to the plaintext brand
    // so `maskApiKey` accepts it. Only legitimate place for this cast.
    maskedKey: maskApiKey(p.key as ApiKeyPlaintext),
    organizationId: p.organizationId,
    sessionCount: p._count.sessions,
    lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json(projectListSchema.parse(data));
});

/**
 * `POST /api/projects` — mint a new project (with its own ingest API key) inside an org.
 *
 * OWNER-only.
 *
 * @remarks
 * Key lifecycle (create / regenerate / copy / delete) is concentrated
 * under OWNER across the product. Admins edit existing projects
 * (rename, display-name trait key) but cannot introduce new ingest
 * credentials on their own.
 */
export const POST = withAuth(async (req, user) => {
  const body = createProjectSchema.parse(await req.json());

  await requireMember(user.id, body.organizationId, "OWNER");

  const project = await prisma.project.create({
    data: {
      name: body.name,
      key: generateApiKey(),
      organizationId: body.organizationId,
    },
    // NOTE: log AFTER select runs (below); cannot reference `project` here.
    select: {
      id: true,
      name: true,
      key: true,
      organizationId: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  log.info("project:create:ok", {
    projectId: project.id,
    name: project.name,
    orgId: project.organizationId,
    byUserId: user.id,
  });

  return NextResponse.json(
    projectSchema.parse({
      id: project.id,
      name: project.name,
      // Trust boundary: Prisma round-trip of the key we just generated.
      maskedKey: maskApiKey(project.key as ApiKeyPlaintext),
      organizationId: project.organizationId,
      sessionCount: 0,
      lastUsedAt: null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }),
    { status: 201 },
  );
});
