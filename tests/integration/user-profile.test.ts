/**
 * `/api/user` — GET / PATCH / DELETE. The DELETE path walks every owned org,
 * transfers ownership, cascades personal-space data, then deletes the user
 * row. The `deleteAccountSchema` literal is the UX lock against misclicks —
 * tests prove both the lock fires AND transaction invariants hold when
 * legitimately submitted.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as userRoute from "@/app/api/user/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createMembership, createOrganization, createUser } from "../helpers/factories";
import { invokeRoute } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("/api/user", () => {
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

  describe("GET /api/user (profile)", () => {
    it("returns the caller's profile with accounts + passkeys placeholders", async () => {
      const alice = await createUser({ name: "Alice", locale: "en" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, email: alice.email })));

      const { status, json } = await invokeRoute<{
        id: string;
        email: string;
        name: string | null;
        accounts: Array<{ provider: string }>;
        passkeys: unknown[];
      }>(userRoute.GET, { method: "GET" });

      expect(status).toBe(200);
      expect(json.id).toBe(alice.id);
      expect(json.email).toBe(alice.email);
      expect(json.name).toBe("Alice");
      expect(json.accounts).toEqual([]);
      expect(json.passkeys).toEqual([]);
    });
  });

  describe("PATCH /api/user (rename)", () => {
    it("updates the user's display name", async () => {
      const alice = await createUser({ name: "Old Name" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRoute(userRoute.PATCH, {
        method: "PATCH",
        body: { name: "New Name" },
      });

      expect(status).toBe(204);
      const refreshed = await prisma.user.findUnique({ where: { id: alice.id } });
      expect(refreshed?.name).toBe("New Name");
    });

    it("rejects short names with 400", async () => {
      const alice = await createUser();
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRoute(userRoute.PATCH, {
        method: "PATCH",
        body: { name: "x" }, // below min(2)
      });
      expect(status).toBe(400);
    });
  });

  describe("DELETE /api/user (account deletion)", () => {
    it("rejects an incorrect confirmation phrase with 400", async () => {
      const alice = await createUser();
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRoute(userRoute.DELETE, {
        method: "DELETE",
        body: { confirmation: "delete my account please" }, // wrong literal
      });

      expect(status).toBe(400);
      expect(await prisma.user.findUnique({ where: { id: alice.id } })).not.toBeNull();
    });

    it("accepts the exact confirmation literal and cascades solo-orgs + memberships", async () => {
      const alice = await createUser();
      await createOrganization({ owner: alice, type: "PERSONAL" });
      await createOrganization({ owner: alice, type: "TEAM", name: "Alice Solo" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRoute(userRoute.DELETE, {
        method: "DELETE",
        body: { confirmation: "delete my account" },
      });

      expect(status).toBe(204);
      expect(await prisma.user.findUnique({ where: { id: alice.id } })).toBeNull();
      expect(await prisma.organization.count()).toBe(0);
    });

    it("transfers ownership of shared orgs before deleting the user", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const shared = await createOrganization({ owner: alice, type: "TEAM", name: "Shared" });
      await createMembership({ user: bob, organization: shared, role: "VIEWER" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRoute(userRoute.DELETE, {
        method: "DELETE",
        body: { confirmation: "delete my account" },
      });

      expect(status).toBe(204);
      const orgAfter = await prisma.organization.findUnique({ where: { id: shared.id } });
      expect(orgAfter).not.toBeNull();
      const bobMembership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId: bob.id, organizationId: shared.id } },
      });
      expect(bobMembership?.role).toBe("OWNER");
    });
  });
});
