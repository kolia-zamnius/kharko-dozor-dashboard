/**
 * `/api/organizations` + `/api/organizations/[orgId]`. POST creates TEAM + owner
 * Membership in one tx; PATCH is ADMIN+; DELETE is OWNER-only and flips
 * affected users' active org back to Personal Space, wipes invites, cascades
 * projects.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as orgsRoute from "@/app/api/organizations/route";
import * as orgDetailRoute from "@/app/api/organizations/[orgId]/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createMembership, createOrganization, createProject, createUser } from "../helpers/factories";
import { invokeRoute, invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("/api/organizations", () => {
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

  describe("POST /api/organizations (create TEAM org)", () => {
    it("creates a TEAM organization with the caller as OWNER in one transaction", async () => {
      const alice = await createUser();
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status, json } = await invokeRoute<{ id: string; name: string; type: "TEAM" | "PERSONAL" }>(
        orgsRoute.POST,
        { method: "POST", body: { name: "Acme Team" } },
      );

      expect(status).toBe(201);
      expect(json.name).toBe("Acme Team");
      expect(json.type).toBe("TEAM");

      const membership = await prisma.membership.findFirst({ where: { organizationId: json.id } });
      expect(membership?.role).toBe("OWNER");
      expect(membership?.userId).toBe(alice.id);
    });

    it("returns 400 with localised issues for invalid input", async () => {
      const alice = await createUser();
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status, json } = await invokeRoute<{ error: string; issues: unknown[] }>(
        orgsRoute.POST,
        { method: "POST", body: { name: "x" } }, // too short (< 2)
      );
      expect(status).toBe(400);
      expect(json.issues.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/organizations (list memberships)", () => {
    it("lists every org the caller is a member of, including role and member count", async () => {
      const alice = await createUser();
      const orgA = await createOrganization({ owner: alice, name: "Org A" });
      const orgB = await createOrganization({ owner: alice, name: "Org B" });
      const bob = await createUser();
      await createMembership({ user: bob, organization: orgA, role: "VIEWER" });

      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));
      const { status, json } = await invokeRoute<
        Array<{ id: string; role: string; memberCount: number; name: string }>
      >(orgsRoute.GET, { method: "GET" });

      expect(status).toBe(200);
      expect(json).toHaveLength(2);
      const fetchedA = json.find((r) => r.id === orgA.id);
      const fetchedB = json.find((r) => r.id === orgB.id);
      expect(fetchedA?.role).toBe("OWNER");
      expect(fetchedA?.memberCount).toBe(2);
      expect(fetchedB?.memberCount).toBe(1);
    });
  });

  describe("PATCH /api/organizations/[orgId] (rename)", () => {
    it("renames the org for ADMIN+", async () => {
      const alice = await createUser();
      const org = await createOrganization({ owner: alice, name: "Old Name" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(orgDetailRoute.PATCH, {
        method: "PATCH",
        body: { name: "New Name" },
        params: { orgId: org.id },
      });

      expect(status).toBe(204);
      const updated = await prisma.organization.findUnique({ where: { id: org.id } });
      expect(updated?.name).toBe("New Name");
    });

    it("returns 403 for VIEWER on rename attempt", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const org = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: org, role: "VIEWER" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(orgDetailRoute.PATCH, {
        method: "PATCH",
        body: { name: "Bob's Rename" },
        params: { orgId: org.id },
      });

      expect(status).toBe(403);
      const unchanged = await prisma.organization.findUnique({ where: { id: org.id } });
      expect(unchanged?.name).not.toBe("Bob's Rename");
    });
  });

  describe("DELETE /api/organizations/[orgId]", () => {
    it("OWNER deletes a TEAM org and affected users flip back to Personal Space", async () => {
      const alice = await createUser();
      const personal = await createOrganization({ owner: alice, type: "PERSONAL", name: "Alice's Space" });
      const team = await createOrganization({ owner: alice, type: "TEAM", name: "Team" });
      await prisma.user.update({ where: { id: alice.id }, data: { activeOrganizationId: team.id } });
      const project = await createProject({ organization: team });

      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));
      const { status } = await invokeRouteWithParams(orgDetailRoute.DELETE, {
        method: "DELETE",
        params: { orgId: team.id },
      });

      expect(status).toBe(204);
      expect(await prisma.organization.findUnique({ where: { id: team.id } })).toBeNull();
      expect(await prisma.project.findUnique({ where: { id: project.id } })).toBeNull();
      const aliceAfter = await prisma.user.findUnique({ where: { id: alice.id } });
      expect(aliceAfter?.activeOrganizationId).toBe(personal.id);
    });

    it("refuses to delete Personal Space with 403", async () => {
      const alice = await createUser();
      const personal = await createOrganization({ owner: alice, type: "PERSONAL" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(orgDetailRoute.DELETE, {
        method: "DELETE",
        params: { orgId: personal.id },
      });

      expect(status).toBe(403);
      expect(await prisma.organization.findUnique({ where: { id: personal.id } })).not.toBeNull();
    });

    it("returns 403 for ADMIN (OWNER-only destructive op)", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice, type: "TEAM" });
      await createMembership({ user: bob, organization: team, role: "ADMIN" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(orgDetailRoute.DELETE, {
        method: "DELETE",
        params: { orgId: team.id },
      });

      expect(status).toBe(403);
    });
  });
});
