import { withAuth } from "@/app/api/_lib/with-auth";
import { maskApiKey, type ApiKeyPlaintext } from "@/lib/mask-api-key";
import { projectListSchema, projectSchema } from "@/api-client/projects/response-schemas";
import { createProjectSchema } from "@/api-client/projects/validators";
import { generateApiKey } from "@/server/generate-api-key";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";

/** Masked-only — plaintext leaves the server exclusively via `GET /api/projects/[id]/key`. */
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
    // Trust boundary — Prisma string promoted to the brand `maskApiKey` accepts.
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
 * OWNER-only — entire key lifecycle (create/regenerate/copy/delete) lives at
 * OWNER across the product. ADMIN edits existing projects but can't mint new
 * ingest credentials.
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
