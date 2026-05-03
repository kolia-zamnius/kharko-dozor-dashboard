/**
 * `PATCH /api/tracked-users/[userId]/display-name`. Writes the two override
 * fields (`customName`, `displayNameTraitKey`) read by the resolver chain.
 * Covers the ADMIN gate, the zod `refine` ("at least one of customName or
 * traitKey"), and the three per-field modes (set / clear / leave-unchanged).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as displayNameRoute from "@/app/api/tracked-users/[userId]/display-name/route";

import { resolveDisplayName } from "@/api-client/tracked-users/resolve-display-name";
import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import {
  createMembership,
  createOrganization,
  createProject,
  createTrackedUser,
  createUser,
} from "../helpers/factories";
import { invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("PATCH /api/tracked-users/[userId]/display-name", () => {
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

  async function seedTrackedUser() {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    const trackedUser = await createTrackedUser({
      project,
      externalId: "ext-42",
      traits: { email: "tracked@example.com" },
    });
    return { alice, team, project, trackedUser };
  }

  it("ADMIN can set customName — resolver returns it", async () => {
    const { alice, team, trackedUser } = await seedTrackedUser();
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    const { status } = await invokeRouteWithParams(displayNameRoute.PATCH, {
      method: "PATCH",
      body: { customName: "Alice's name" },
      params: { userId: trackedUser.id },
    });

    expect(status).toBe(204);
    const refreshed = await prisma.trackedUser.findUnique({ where: { id: trackedUser.id } });
    expect(refreshed?.customName).toBe("Alice's name");
    expect(
      resolveDisplayName({
        externalId: refreshed!.externalId,
        traits: refreshed!.traits as Record<string, unknown> | null,
        customName: refreshed!.customName,
        displayNameTraitKey: refreshed!.displayNameTraitKey,
        projectDefaultTraitKey: null,
      }),
    ).toBe("Alice's name");
  });

  it("ADMIN can set traitKey — resolver walks to the trait value", async () => {
    const { alice, team, trackedUser } = await seedTrackedUser();
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    const { status } = await invokeRouteWithParams(displayNameRoute.PATCH, {
      method: "PATCH",
      body: { traitKey: "email" },
      params: { userId: trackedUser.id },
    });

    expect(status).toBe(204);
    const refreshed = await prisma.trackedUser.findUnique({ where: { id: trackedUser.id } });
    expect(refreshed?.displayNameTraitKey).toBe("email");
    expect(
      resolveDisplayName({
        externalId: refreshed!.externalId,
        traits: refreshed!.traits as Record<string, unknown> | null,
        customName: refreshed!.customName,
        displayNameTraitKey: refreshed!.displayNameTraitKey,
        projectDefaultTraitKey: null,
      }),
    ).toBe("tracked@example.com");
  });

  it("null clears customName — resolver falls through", async () => {
    const { alice, team, project, trackedUser } = await seedTrackedUser();
    await prisma.trackedUser.update({ where: { id: trackedUser.id }, data: { customName: "Temporary" } });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    const { status } = await invokeRouteWithParams(displayNameRoute.PATCH, {
      method: "PATCH",
      body: { customName: null },
      params: { userId: trackedUser.id },
    });

    expect(status).toBe(204);
    const refreshed = await prisma.trackedUser.findUnique({ where: { id: trackedUser.id } });
    expect(refreshed?.customName).toBeNull();
    expect(
      resolveDisplayName({
        externalId: refreshed!.externalId,
        traits: refreshed!.traits as Record<string, unknown> | null,
        customName: refreshed!.customName,
        displayNameTraitKey: refreshed!.displayNameTraitKey,
        projectDefaultTraitKey: null,
      }),
    ).toBe(trackedUser.externalId);
    void project; // reference so TS keeps the binding
  });

  it("returns 400 when neither field is provided (zod refine guard)", async () => {
    const { alice, team, trackedUser } = await seedTrackedUser();
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    const { status } = await invokeRouteWithParams(displayNameRoute.PATCH, {
      method: "PATCH",
      body: {},
      params: { userId: trackedUser.id },
    });
    expect(status).toBe(400);
  });

  it("returns 403 for VIEWER (ADMIN+ gate)", async () => {
    const { team, trackedUser } = await seedTrackedUser();
    const bob = await createUser();
    await createMembership({ user: bob, organization: team, role: "VIEWER" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id, activeOrganizationId: team.id })));

    const { status } = await invokeRouteWithParams(displayNameRoute.PATCH, {
      method: "PATCH",
      body: { customName: "Hacked" },
      params: { userId: trackedUser.id },
    });
    expect(status).toBe(403);
  });

  it("returns 404 for a tracked user that doesn't exist", async () => {
    const alice = await createUser();
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRouteWithParams(displayNameRoute.PATCH, {
      method: "PATCH",
      body: { customName: "ghost" },
      params: { userId: "tu_does_not_exist" },
    });
    expect(status).toBe(404);
  });
});
