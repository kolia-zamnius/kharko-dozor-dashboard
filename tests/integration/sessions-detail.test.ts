/**
 * Integration tests for `/api/sessions/[sessionId]` — GET (detail) + DELETE.
 *
 * @remarks
 * The replay player's primary read endpoint. Permission gate is VIEWER+
 * (any org member can watch); delete is ADMIN+ (so QA/staging cleanup
 * stays unblocked without an OWNER on call). The route's "legacy
 * inline-events" branch covers pre-slice recordings — important to
 * keep tested while old sessions can still exist in the wild.
 */

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
    it("returns session detail with sliced events for any member", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      await prisma.slice.create({
        data: {
          sessionId: session.id,
          index: 0,
          reason: "init",
          pathname: "/",
          url: "https://example.com/",
          startedAt: new Date(),
          duration: 1000,
          eventCount: 0,
        },
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status, json } = await invokeRouteWithParams<
        { sessionId: string },
        {
          id: string;
          projectId: string;
          slices: Array<{ index: number; reason: string }>;
          events: unknown[];
        }
      >(sessionRoute.GET, {
        method: "GET",
        params: { sessionId: session.id },
      });

      expect(status).toBe(200);
      expect(json.id).toBe(session.id);
      expect(json.projectId).toBe(project.id);
      expect(json.slices).toHaveLength(1);
      expect(json.slices[0]?.reason).toBe("init");
      // Post-slice sessions don't inline events — the slice-events route
      // serves them on demand.
      expect(json.events).toEqual([]);
    });

    it("inlines events for legacy sessions (no slices)", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      await prisma.event.createMany({
        data: [
          { sessionId: session.id, type: 4, timestamp: BigInt(1), data: { href: "https://example.com" } },
          { sessionId: session.id, type: 2, timestamp: BigInt(2), data: { node: {} } },
        ],
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status, json } = await invokeRouteWithParams<
        { sessionId: string },
        { slices: unknown[]; events: Array<{ type: number; timestamp: number }> }
      >(sessionRoute.GET, {
        method: "GET",
        params: { sessionId: session.id },
      });

      expect(status).toBe(200);
      expect(json.slices).toEqual([]);
      expect(json.events).toHaveLength(2);
      // BigInt timestamps coerce to Number on the way out.
      expect(typeof json.events[0]?.timestamp).toBe("number");
    });

    it("returns 403 for a non-member of the owning org", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(sessionRoute.GET, {
        method: "GET",
        params: { sessionId: session.id },
      });
      expect(status).toBe(403);
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
    it("ADMIN deletes a session — cascades slices + events", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "ADMIN" });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      const slice = await prisma.slice.create({
        data: {
          sessionId: session.id,
          index: 0,
          reason: "init",
          pathname: "/",
          url: "https://example.com/",
          startedAt: new Date(),
        },
      });
      await prisma.event.create({
        data: { sessionId: session.id, sliceId: slice.id, type: 2, timestamp: BigInt(1), data: {} },
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(sessionRoute.DELETE, {
        method: "DELETE",
        params: { sessionId: session.id },
      });

      expect(status).toBe(204);
      expect(await prisma.session.findUnique({ where: { id: session.id } })).toBeNull();
      expect(await prisma.slice.count({ where: { sessionId: session.id } })).toBe(0);
      expect(await prisma.event.count({ where: { sessionId: session.id } })).toBe(0);
    });

    it("returns 403 for VIEWER (ADMIN+ required for delete)", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "VIEWER" });
      const project = await createProject({ organization: team });
      const session = await createSession({ project });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

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
