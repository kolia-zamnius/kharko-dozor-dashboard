import { withAuth } from "@/app/api/_lib/with-auth";
import { userProfileSchema } from "@/api-client/user/response-schemas";
import { deleteAccountSchema, updateProfileSchema } from "@/api-client/user/validators";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";
import { transferOrganizationOwnership } from "./_helpers/transfer-ownership";

/**
 * `GET /api/user` — signed-in user's full profile.
 *
 * @remarks
 * Returns name / email / avatar + linked OAuth accounts + registered
 * passkeys. Powers the settings page's connect / disconnect / rename
 * affordances.
 *
 * @throws {HttpError} 404 — user row missing (should never happen post-auth).
 * @see {@link userProfileOptions} — client-side consumer.
 */
export const GET = withAuth(async (req, user) => {
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      accounts: { select: { provider: true } },
      authenticators: {
        select: { credentialID: true, name: true, credentialDeviceType: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!profile) {
    throw new HttpError(404, "User not found");
  }

  // Response DTO validated at the server boundary — see the module
  // JSDoc on `userProfileSchema` for the rationale. A shape drift
  // (extra field from a Prisma `select` extension, renamed column,
  // missing timestamp conversion) surfaces as an explicit 500 here
  // instead of silently reaching the client.
  return NextResponse.json(
    userProfileSchema.parse({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      image: profile.image,
      createdAt: profile.createdAt.toISOString(),
      accounts: profile.accounts.map((a) => ({ provider: a.provider })),
      passkeys: profile.authenticators.map((a) => ({
        credentialID: a.credentialID,
        name: a.name,
        credentialDeviceType: a.credentialDeviceType,
        createdAt: a.createdAt.toISOString(),
      })),
    }),
  );
});

/**
 * `PATCH /api/user` — update the signed-in user's display name.
 *
 * @remarks
 * Avatar regeneration has its own endpoint (`POST /api/user/avatar`)
 * — the two actions live in different parts of the profile form.
 */
export const PATCH = withAuth(async (req, user) => {
  const body = updateProfileSchema.parse(await req.json());

  await prisma.user.update({
    where: { id: user.id },
    data: { name: body.name },
  });

  log.info("user:rename:ok", { userId: user.id, name: body.name });

  return new Response(null, { status: 204 });
});

/**
 * `DELETE /api/user` — hard-delete the signed-in user's account.
 *
 * Destructive.
 *
 * @remarks
 * Body carries a confirmation phrase — `deleteAccountSchema` enforces
 * it server-side so a misclick can't wipe the account.
 *
 * Per-org handling inside one transaction:
 *   - Solo-member orgs are deleted outright (cascades invites + full
 *     data hierarchy).
 *   - Shared orgs get {@link transferOrganizationOwnership} so an
 *     ownerless org is impossible after the cascade.
 *
 * The user row is deleted last — cascades accounts, authenticators,
 * memberships.
 */
export const DELETE = withAuth(async (req, user) => {
  deleteAccountSchema.parse(await req.json());

  const summary = await prisma.$transaction(async (tx) => {
    const userOrgs = await tx.organization.findMany({
      where: { memberships: { some: { userId: user.id } } },
      include: {
        _count: { select: { memberships: true } },
        memberships: { where: { userId: user.id }, select: { role: true }, take: 1 },
      },
    });

    const soloOrgIds = userOrgs.filter((o) => o._count.memberships === 1).map((o) => o.id);
    const sharedOrgs = userOrgs.filter((o) => o._count.memberships > 1);

    if (soloOrgIds.length > 0) {
      await tx.invite.deleteMany({ where: { organizationId: { in: soloOrgIds } } });
      await tx.organization.deleteMany({ where: { id: { in: soloOrgIds } } });
    }

    for (const org of sharedOrgs) {
      const userRole = org.memberships[0]?.role ?? "VIEWER";
      await transferOrganizationOwnership(tx, org.id, org.createdById, user.id, userRole);
    }

    await tx.user.delete({ where: { id: user.id } });

    return { soloOrgsDeleted: soloOrgIds.length, sharedOrgsTransferred: sharedOrgs.length };
  });

  log.info("user:delete:ok", {
    userId: user.id,
    summary,
  });

  return new Response(null, { status: 204 });
});
