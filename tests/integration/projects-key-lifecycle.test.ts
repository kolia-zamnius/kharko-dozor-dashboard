/**
 * Project API-key lifecycle. Plaintext leaves the server at exactly ONE route
 * (`GET /api/projects/[id]/key`); every other response carries the masked form.
 * Regeneration atomically invalidates the old key; delete cascades to sessions.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as projectsRoute from "@/app/api/projects/route";
import * as projectDetailRoute from "@/app/api/projects/[projectId]/route";
import * as projectKeyRoute from "@/app/api/projects/[projectId]/key/route";
import * as projectRegenerateRoute from "@/app/api/projects/[projectId]/regenerate-key/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createMembership, createOrganization, createProject, createSession, createUser } from "../helpers/factories";
import { invokeRoute, invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("project API-key lifecycle", () => {
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

  describe("POST /api/projects (create)", () => {
    it("OWNER creates a project with a fresh dp_-prefixed key, returned masked", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status, json } = await invokeRoute<{
        id: string;
        name: string;
        maskedKey: string;
        organizationId: string;
      }>(projectsRoute.POST, {
        method: "POST",
        body: { name: "Website", organizationId: team.id },
      });

      expect(status).toBe(201);
      expect(json.name).toBe("Website");
      expect(json.maskedKey.startsWith("dp_")).toBe(true);
      expect(json.maskedKey).toMatch(/•/);

      const stored = await prisma.project.findUnique({ where: { id: json.id } });
      expect(stored?.key).toMatch(/^dp_[a-f0-9]{32}$/);
      expect(json).not.toHaveProperty("key");
    });

    it("returns 403 for ADMIN (OWNER-only key lifecycle)", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "ADMIN" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRoute(projectsRoute.POST, {
        method: "POST",
        // Name ≥2 chars so zod passes — otherwise 400 fires before the 403 we want to test.
        body: { name: "Project X", organizationId: team.id },
      });
      expect(status).toBe(403);
    });
  });

  describe("GET /api/projects (list)", () => {
    it("returns masked keys only — plaintext never leaks via list", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status, json } = await invokeRoute<Array<{ id: string; maskedKey: string }>>(projectsRoute.GET, {
        method: "GET",
      });

      expect(status).toBe(200);
      expect(json).toHaveLength(1);
      const entry = json[0]!;
      expect(entry.id).toBe(project.id);
      expect(entry.maskedKey).toMatch(/^dp_.+•.+$/);
      expect((entry as unknown as { key?: string }).key).toBeUndefined();
    });
  });

  describe("GET /api/projects/[projectId]/key (plaintext on demand)", () => {
    it("OWNER receives the plaintext key with Cache-Control: no-store", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { response, status, json } = await invokeRouteWithParams<{ projectId: string }, { key: string }>(
        projectKeyRoute.GET,
        {
          method: "GET",
          params: { projectId: project.id },
        },
      );

      expect(status).toBe(200);
      expect(response.headers.get("cache-control")).toMatch(/no-store/);
      expect(json.key).toBe(project.key);
    });

    it("returns 403 for ADMIN — plaintext is OWNER-only", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "ADMIN" });
      const project = await createProject({ organization: team });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(projectKeyRoute.GET, {
        method: "GET",
        params: { projectId: project.id },
      });
      expect(status).toBe(403);
    });
  });

  describe("POST /api/projects/[projectId]/regenerate-key", () => {
    it("invalidates the old key atomically — old key no longer resolves, new one does", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      const oldKey = project.key;
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status, json } = await invokeRouteWithParams<{ projectId: string }, { id: string; maskedKey: string }>(
        projectRegenerateRoute.POST,
        {
          method: "POST",
          params: { projectId: project.id },
        },
      );

      expect(status).toBe(200);
      expect(json.id).toBe(project.id);
      expect(json.maskedKey).toMatch(/^dp_/);

      const refreshed = await prisma.project.findUnique({ where: { id: project.id } });
      expect(refreshed?.key).not.toBe(oldKey);
      expect(refreshed?.lastUsedAt).toBeNull();

      // Old key no longer resolves — unique index updated in place by the single `update` call.
      const byOldKey = await prisma.project.findUnique({ where: { key: oldKey } });
      expect(byOldKey).toBeNull();
    });
  });

  describe("DELETE /api/projects/[projectId]", () => {
    it("OWNER deletes and cascades sessions (and their events)", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      await createSession({ project });
      await createSession({ project });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(projectDetailRoute.DELETE, {
        method: "DELETE",
        params: { projectId: project.id },
      });

      expect(status).toBe(204);
      expect(await prisma.project.findUnique({ where: { id: project.id } })).toBeNull();
      expect(await prisma.session.count({ where: { projectId: project.id } })).toBe(0);
    });

    it("returns 403 for ADMIN (OWNER-only)", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "ADMIN" });
      const project = await createProject({ organization: team });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(projectDetailRoute.DELETE, {
        method: "DELETE",
        params: { projectId: project.id },
      });
      expect(status).toBe(403);
    });
  });
});
