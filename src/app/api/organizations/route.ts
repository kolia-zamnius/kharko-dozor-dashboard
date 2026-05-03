import { withAuth } from "@/app/api/_lib/with-auth";
import { orgAvatarUrl } from "@/lib/avatar";
import { organizationCreatedSchema, organizationListSchema } from "@/api-client/organizations/response-schemas";
import { createOrgSchema } from "@/api-client/organizations/validators";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";

/** Ordered by `createdAt ASC` so Personal Space (oldest) surfaces first in the switcher. */
export const GET = withAuth(async (req, user) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          image: true,
          type: true,
          createdAt: true,
          _count: { select: { memberships: true } },
        },
      },
    },
    orderBy: { organization: { createdAt: "asc" } },
  });

  const data = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    image: m.organization.image,
    type: m.organization.type,
    role: m.role,
    membershipId: m.id,
    memberCount: m.organization._count.memberships,
    createdAt: m.organization.createdAt.toISOString(),
  }));

  return NextResponse.json(organizationListSchema.parse(data));
});

/** Tx so creator's `Membership` lands with the `Organization` — a crash between would leave an ownerless org. Personal Spaces come from the Auth.js `createUser` event. */
export const POST = withAuth(async (req, user) => {
  const body = createOrgSchema.parse(await req.json());

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name: body.name,
        image: orgAvatarUrl(crypto.randomUUID()),
        type: "TEAM",
        createdById: user.id,
      },
    });

    await tx.membership.create({
      data: { userId: user.id, organizationId: created.id, role: "OWNER" },
    });

    return created;
  });

  log.info("org:create:ok", {
    orgId: org.id,
    name: org.name,
    type: org.type,
    byUserId: user.id,
  });

  return NextResponse.json(
    organizationCreatedSchema.parse({ id: org.id, name: org.name, image: org.image, type: org.type }),
    { status: 201 },
  );
});
