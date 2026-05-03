/**
 * `PATCH /api/organizations/active`. Security invariant: the pointer can ONLY
 * land on an org the caller is a member of — otherwise downstream
 * `requireMember` checks reading from the active pointer would be bypassed.
 * Membership check + update run in one transaction to close the
 * concurrent-remove-member race.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as activeRoute from "@/app/api/organizations/active/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createOrganization, createUser } from "../helpers/factories";
import { invokeRoute } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("PATCH /api/organizations/active", () => {
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

  it("flips activeOrganizationId for an org the caller belongs to", async () => {
    const alice = await createUser();
    const personal = await createOrganization({ owner: alice, type: "PERSONAL" });
    const team = await createOrganization({ owner: alice, type: "TEAM" });
    await prisma.user.update({ where: { id: alice.id }, data: { activeOrganizationId: personal.id } });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRoute(activeRoute.PATCH, {
      method: "PATCH",
      body: { organizationId: team.id },
    });

    expect(status).toBe(204);
    const refreshed = await prisma.user.findUnique({ where: { id: alice.id } });
    expect(refreshed?.activeOrganizationId).toBe(team.id);
  });

  it("returns 403 when switching to an org the caller is NOT a member of", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const bobsOrg = await createOrganization({ owner: bob, type: "TEAM" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRoute(activeRoute.PATCH, {
      method: "PATCH",
      body: { organizationId: bobsOrg.id },
    });

    expect(status).toBe(403);
    // Pointer unchanged — transaction rolled back.
    const aliceAfter = await prisma.user.findUnique({ where: { id: alice.id } });
    expect(aliceAfter?.activeOrganizationId).not.toBe(bobsOrg.id);
  });

  it("returns 400 for missing organizationId", async () => {
    const alice = await createUser();
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRoute(activeRoute.PATCH, {
      method: "PATCH",
      body: {},
    });
    expect(status).toBe(400);
  });
});
