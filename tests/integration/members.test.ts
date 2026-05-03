/**
 * Member PATCH (role change, OWNER-only) + DELETE (remove + self-leave).
 * Covers edges past the matrix: last-owner-leave ownership transfer,
 * only-member 409, Personal-Space leave protection, and a removed user's
 * `activeOrganizationId` flipping back to Personal Space.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as memberDetailRoute from "@/app/api/organizations/[orgId]/members/[memberId]/route";
import * as membersRoute from "@/app/api/organizations/[orgId]/members/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createMembership, createOrganization, createUser } from "../helpers/factories";
import { invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("members management", () => {
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

  describe("GET /api/organizations/[orgId]/members", () => {
    it("lists every member of an org for VIEWER+", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const carol = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "ADMIN" });
      await createMembership({ user: carol, organization: team, role: "VIEWER" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: carol.id })));

      const { status, json } = await invokeRouteWithParams<
        { orgId: string },
        Array<{ id: string; role: string; user: { id: string } }>
      >(membersRoute.GET, {
        method: "GET",
        params: { orgId: team.id },
      });

      expect(status).toBe(200);
      expect(json).toHaveLength(3);
      const roles = json.map((m) => m.role).sort();
      expect(roles).toEqual(["ADMIN", "OWNER", "VIEWER"]);
    });
  });

  describe("PATCH .../members/[memberId] — change role", () => {
    it("OWNER promotes VIEWER → ADMIN", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      const bobMembership = await createMembership({ user: bob, organization: team, role: "VIEWER" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(memberDetailRoute.PATCH, {
        method: "PATCH",
        body: { role: "ADMIN" },
        params: { orgId: team.id, memberId: bobMembership.id },
      });

      expect(status).toBe(204);
      const refreshed = await prisma.membership.findUnique({ where: { id: bobMembership.id } });
      expect(refreshed?.role).toBe("ADMIN");
    });

    it("returns 403 for ADMIN (OWNER-only governance)", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const carol = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "ADMIN" });
      const carolMembership = await createMembership({ user: carol, organization: team, role: "VIEWER" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(memberDetailRoute.PATCH, {
        method: "PATCH",
        body: { role: "ADMIN" },
        params: { orgId: team.id, memberId: carolMembership.id },
      });

      expect(status).toBe(403);
    });

    it("returns 404 for an unknown memberId", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(memberDetailRoute.PATCH, {
        method: "PATCH",
        body: { role: "ADMIN" },
        params: { orgId: team.id, memberId: "mem_does_not_exist" },
      });
      expect(status).toBe(404);
    });
  });

  describe("DELETE .../members/[memberId] — remove / self-leave", () => {
    it("self-leave removes the membership and flips activeOrgId to Personal Space", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const personal = await createOrganization({ owner: bob, type: "PERSONAL" });
      const team = await createOrganization({ owner: alice });
      const bobMembership = await createMembership({ user: bob, organization: team, role: "ADMIN" });
      await prisma.user.update({ where: { id: bob.id }, data: { activeOrganizationId: team.id } });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(memberDetailRoute.DELETE, {
        method: "DELETE",
        params: { orgId: team.id, memberId: bobMembership.id },
      });

      expect(status).toBe(204);
      expect(await prisma.membership.findUnique({ where: { id: bobMembership.id } })).toBeNull();
      const bobAfter = await prisma.user.findUnique({ where: { id: bob.id } });
      expect(bobAfter?.activeOrganizationId).toBe(personal.id);
    });

    it("last OWNER leaving transfers ownership to the next-oldest remaining member", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      const bobMembership = await createMembership({ user: bob, organization: team, role: "VIEWER" });
      const aliceMembership = await prisma.membership.findFirstOrThrow({
        where: { userId: alice.id, organizationId: team.id },
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(memberDetailRoute.DELETE, {
        method: "DELETE",
        params: { orgId: team.id, memberId: aliceMembership.id },
      });

      expect(status).toBe(204);
      expect(await prisma.membership.findUnique({ where: { id: aliceMembership.id } })).toBeNull();
      const bobAfter = await prisma.membership.findUnique({ where: { id: bobMembership.id } });
      expect(bobAfter?.role).toBe("OWNER");
    });

    it("returns 409 when the only member tries to leave", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const aliceMembership = await prisma.membership.findFirstOrThrow({
        where: { userId: alice.id, organizationId: team.id },
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(memberDetailRoute.DELETE, {
        method: "DELETE",
        params: { orgId: team.id, memberId: aliceMembership.id },
      });

      expect(status).toBe(409);
      expect(await prisma.membership.findUnique({ where: { id: aliceMembership.id } })).not.toBeNull();
    });

    it("refuses to leave Personal Space with 403", async () => {
      const alice = await createUser();
      const personal = await createOrganization({ owner: alice, type: "PERSONAL" });
      const aliceMembership = await prisma.membership.findFirstOrThrow({
        where: { userId: alice.id, organizationId: personal.id },
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(memberDetailRoute.DELETE, {
        method: "DELETE",
        params: { orgId: personal.id, memberId: aliceMembership.id },
      });
      expect(status).toBe(403);
    });

    it("OWNER can remove another member", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      const bobMembership = await createMembership({ user: bob, organization: team, role: "VIEWER" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(memberDetailRoute.DELETE, {
        method: "DELETE",
        params: { orgId: team.id, memberId: bobMembership.id },
      });

      expect(status).toBe(204);
      expect(await prisma.membership.findUnique({ where: { id: bobMembership.id } })).toBeNull();
    });

    it("non-OWNER cannot remove another member (403)", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const carol = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "ADMIN" });
      const carolMembership = await createMembership({ user: carol, organization: team, role: "VIEWER" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(memberDetailRoute.DELETE, {
        method: "DELETE",
        params: { orgId: team.id, memberId: carolMembership.id },
      });
      expect(status).toBe(403);
    });
  });
});
