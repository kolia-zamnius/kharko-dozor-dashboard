// `/api/sessions/[sessionId]` — GET + DELETE. VIEWER+ for read; DELETE is
// ADMIN+ (QA/staging cleanup without an OWNER on call).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as sessionRoute from "@/app/api/sessions/[sessionId]/route";
import * as eventsRoute from "@/app/api/sessions/[sessionId]/events/route";
import * as markersRoute from "@/app/api/sessions/[sessionId]/markers/route";

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

  describe("GET /events", () => {
    it("returns event batches as base64-gzip blobs for any member", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      await prisma.eventBatch.create({
        data: {
          sessionId: session.id,
          firstTimestamp: BigInt(1_700_000_000_000),
          lastTimestamp: BigInt(1_700_000_001_000),
          eventCount: 3,
          // Real callers ship gzip blobs; raw bytes round-trip through base64 just as well for shape coverage.
          data: Buffer.from([0x1f, 0x8b, 0x08]),
        },
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

      const { status, json } = await invokeRouteWithParams<
        { sessionId: string },
        { batches: Array<{ id: string; firstTimestamp: number; eventCount: number; data: string }>; nextCursor: null }
      >(eventsRoute.GET, { method: "GET", params: { sessionId: session.id } });

      expect(status).toBe(200);
      expect(json.batches).toHaveLength(1);
      expect(json.batches[0]?.eventCount).toBe(3);
      expect(typeof json.batches[0]?.data).toBe("string");
      expect(json.nextCursor).toBeNull();
    });

    it("returns 404 for a non-member querying another org's session — no existence oracle", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      const bobOrg = await createOrganization({ owner: bob });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id, activeOrganizationId: bobOrg.id })));

      const { status } = await invokeRouteWithParams(eventsRoute.GET, {
        method: "GET",
        params: { sessionId: session.id },
      });
      expect(status).toBe(404);
    });
  });

  describe("GET /markers", () => {
    it("returns typed markers ordered by timestamp; `?kind=` filters", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      await prisma.marker.createMany({
        data: [
          { sessionId: session.id, timestamp: BigInt(2_000), kind: "url", data: { pathname: "/home" } },
          { sessionId: session.id, timestamp: BigInt(1_000), kind: "identity", data: { userId: "u1" } },
          { sessionId: session.id, timestamp: BigInt(3_000), kind: "url", data: { pathname: "/checkout" } },
        ],
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

      const { status, json } = await invokeRouteWithParams<
        { sessionId: string },
        { markers: Array<{ kind: string; timestamp: number }> }
      >(markersRoute.GET, { method: "GET", params: { sessionId: session.id } });

      expect(status).toBe(200);
      expect(json.markers).toHaveLength(3);
      expect(json.markers.map((m) => m.timestamp)).toEqual([1_000, 2_000, 3_000]);

      const { status: kindStatus, json: kindJson } = await invokeRouteWithParams<
        { sessionId: string },
        { markers: Array<{ kind: string }> }
      >(markersRoute.GET, {
        method: "GET",
        url: `http://localhost/api/sessions/${session.id}/markers?kind=url`,
        params: { sessionId: session.id },
      });

      expect(kindStatus).toBe(200);
      expect(kindJson.markers.every((m) => m.kind === "url")).toBe(true);
      expect(kindJson.markers).toHaveLength(2);
    });

    it("returns 404 for a non-member — no existence oracle", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      const bobOrg = await createOrganization({ owner: bob });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id, activeOrganizationId: bobOrg.id })));

      const { status } = await invokeRouteWithParams(markersRoute.GET, {
        method: "GET",
        params: { sessionId: session.id },
      });
      expect(status).toBe(404);
    });
  });
});
