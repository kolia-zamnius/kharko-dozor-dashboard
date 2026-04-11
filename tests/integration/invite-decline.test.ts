/**
 * Integration tests for `POST /api/user/invites/[id]/decline`.
 *
 * @remarks
 * Companion to the `accept` suite in `invites.test.ts`. Decline is
 * intentionally a hard-delete — no `InviteStatus.DECLINED` — so the
 * admin-side list (which filters on `PENDING`) stays clean without a
 * second status to special-case. If the admin still wants the user,
 * they resend.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as declineRoute from "@/app/api/user/invites/[id]/decline/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createInvite, createOrganization, createUser } from "../helpers/factories";
import { invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("POST /api/user/invites/[id]/decline", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await getTestPrisma();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("hard-deletes a pending invite addressed to the caller", async () => {
    const alice = await createUser();
    const bob = await createUser({ email: "bob@test.local" });
    const team = await createOrganization({ owner: alice });
    const invite = await createInvite({
      organization: team,
      email: "bob@test.local",
      invitedBy: alice,
    });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id, email: "bob@test.local" })));

    const { status } = await invokeRouteWithParams(declineRoute.POST, {
      method: "POST",
      params: { id: invite.id },
    });

    expect(status).toBe(200);
    expect(await prisma.invite.findUnique({ where: { id: invite.id } })).toBeNull();
  });

  it("rejects with the invite-lifecycle guard when the email doesn't match", async () => {
    const alice = await createUser();
    const carol = await createUser({ email: "carol@test.local" });
    const team = await createOrganization({ owner: alice });
    const invite = await createInvite({
      organization: team,
      email: "bob@test.local", // different recipient
      invitedBy: alice,
    });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: carol.id, email: "carol@test.local" })));

    const { status } = await invokeRouteWithParams(declineRoute.POST, {
      method: "POST",
      params: { id: invite.id },
    });

    // `assertInviteUsableForUser` throws HttpError for cross-email access.
    expect(status).toBeGreaterThanOrEqual(400);
    expect(await prisma.invite.findUnique({ where: { id: invite.id } })).not.toBeNull();
  });

  it("returns 4xx for an invite id that doesn't exist", async () => {
    const alice = await createUser();
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, email: alice.email })));

    const { status } = await invokeRouteWithParams(declineRoute.POST, {
      method: "POST",
      params: { id: "inv_bogus" },
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });
});
