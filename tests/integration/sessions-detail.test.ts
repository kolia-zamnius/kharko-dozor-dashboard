// `/api/sessions/[sessionId]` — GET + DELETE. VIEWER+ for read; DELETE is
// ADMIN+ (QA/staging cleanup without an OWNER on call).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as sessionRoute from "@/app/api/sessions/[sessionId]/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createMembership, createOrganization, createProject, createSession, createUser } from "../helpers/factories";
import { invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("/api/sessions/[sessionId]", () => {
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

  describe("GET — detail", () => {
    it("returns session detail with marker list for any member", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      await prisma.marker.create({
        data: {
          sessionId: session.id,
          timestamp: BigInt(Date.now()),
          kind: "url",
          data: { url: "https://example.com/", pathname: "/" },
        },
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

      const { status, json } = await invokeRouteWithParams<
        { sessionId: string },
        {
          id: string;
          projectId: string;
          markers: Array<{ kind: string; timestamp: number }>;
        }
      >(sessionRoute.GET, {
        method: "GET",
        params: { sessionId: session.id },
      });

      expect(status).toBe(200);
      expect(json.id).toBe(session.id);
      expect(json.projectId).toBe(project.id);
      expect(json.markers).toHaveLength(1);
      expect(json.markers[0]?.kind).toBe("url");
      expect(typeof json.markers[0]?.timestamp).toBe("number");
    });

    it("returns 404 for a non-member querying another org's session", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      const bobOrg = await createOrganization({ owner: bob });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id, activeOrganizationId: bobOrg.id })));

      const { status } = await invokeRouteWithParams(sessionRoute.GET, {
        method: "GET",
        params: { sessionId: session.id },
      });
      expect(status).toBe(404);
    });

    it("returns 404 for an unknown sessionId", async () => {
      const alice = await createUser();
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(sessionRoute.GET, {
        method: "GET",
        params: { sessionId: "sess_does_not_exist" },
      });
      expect(status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("ADMIN deletes a session — cascades event-batches + markers", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "ADMIN" });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      await prisma.eventBatch.create({
        data: {
          sessionId: session.id,
          firstTimestamp: BigInt(1),
          lastTimestamp: BigInt(2),
          eventCount: 1,
          data: Buffer.from(""),
        },
      });
      await prisma.marker.create({
        data: { sessionId: session.id, timestamp: BigInt(1), kind: "url", data: {} },
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id, activeOrganizationId: team.id })));

      const { status } = await invokeRouteWithParams(sessionRoute.DELETE, {
        method: "DELETE",
        params: { sessionId: session.id },
      });

      expect(status).toBe(204);
      expect(await prisma.session.findUnique({ where: { id: session.id } })).toBeNull();
      expect(await prisma.eventBatch.count({ where: { sessionId: session.id } })).toBe(0);
      expect(await prisma.marker.count({ where: { sessionId: session.id } })).toBe(0);
    });

    it("returns 403 for VIEWER (ADMIN+ required for delete)", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "VIEWER" });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id, activeOrganizationId: team.id })));

      const { status } = await invokeRouteWithParams(sessionRoute.DELETE, {
        method: "DELETE",
        params: { sessionId: session.id },
      });

      expect(status).toBe(403);
      expect(await prisma.session.findUnique({ where: { id: session.id } })).not.toBeNull();
    });

    it("returns 404 for an unknown sessionId", async () => {
      const alice = await createUser();
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(sessionRoute.DELETE, {
        method: "DELETE",
        params: { sessionId: "sess_bogus" },
      });
      expect(status).toBe(404);
    });
  });
});
