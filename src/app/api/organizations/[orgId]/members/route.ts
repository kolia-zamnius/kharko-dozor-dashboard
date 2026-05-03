import { withAuth } from "@/app/api/_lib/with-auth";
import { organizationMemberListSchema } from "@/api-client/organizations/response-schemas";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { NextResponse } from "next/server";

type Params = { orgId: string };

/** VIEWER+ — every member sees the roster; role-change/remove are gated on `[memberId]`. */
export const GET = withAuth<Params>(async (req, user, { orgId }) => {
  await requireMember(user.id, orgId, "VIEWER");

  const members = await prisma.membership.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const data = members.map((m) => ({
    id: m.id,
    role: m.role,
    joinedAt: m.createdAt.toISOString(),
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
    },
  }));

  return NextResponse.json(organizationMemberListSchema.parse(data));
});
