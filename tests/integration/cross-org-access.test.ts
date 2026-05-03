/**
 * Cross-org access guard. Bug it fixed: a user in two orgs (A active, B
 * background) opening `/users/{id}` for a B-owned resource saw B's data while
 * chrome still showed A. `requireResourceAccess` enforces "resource must live
 * in the active org" with an opaque 404 (not 403) — guessed IDs never confirm
 * existence to a foreign-org member.
 *
 * Cross-org axis lives in one file so it's obvious which routes opted into
 * the guard and which were missed if the helper rolls out further.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as sessionRoute from "@/app/api/sessions/[sessionId]/route";
import * as sliceEventsRoute from "@/app/api/sessions/[sessionId]/slices/[sliceIndex]/events/route";
import * as trackedUserRoute from "@/app/api/tracked-users/[userId]/route";
import * as trackedUserActivityRoute from "@/app/api/tracked-users/[userId]/activity/route";
import * as trackedUserSessionsRoute from "@/app/api/tracked-users/[userId]/sessions/route";
import * as trackedUserStatusRoute from "@/app/api/tracked-users/[userId]/status/route";
import * as trackedUserTimelineRoute from "@/app/api/tracked-users/[userId]/timeline/route";
import * as trackedUserDisplayNameRoute from "@/app/api/tracked-users/[userId]/display-name/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import {
  createMembership,
  createOrganization,
  createProject,
  createSession,
  createTrackedUser,
  createUser,
} from "../helpers/factories";
import { invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("cross-org access guard", () => {
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

  /** Actor is member of A (active) + B; resource lives in B. The guard must refuse despite the B membership — only the active org matters. */
  async function seedActorWithForeignResource() {
    const founder = await createUser();
    const actor = await createUser();
    const orgA = await createOrganization({ owner: founder });
    const orgB = await createOrganization({ owner: founder });
    await createMembership({ user: actor, organization: orgA, role: "ADMIN" });
    await createMembership({ user: actor, organization: orgB, role: "ADMIN" });
    const projectB = await createProject({ organization: orgB });
    const trackedUser = await createTrackedUser({ project: projectB });
    const session = await createSession({ project: projectB, trackedUser });
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

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: actor.id, activeOrganizationId: orgA.id })));

    return { actor, orgA, orgB, projectB, trackedUser, session, slice };
  }

  it("GET /api/sessions/[id] returns 404 for a foreign-org session", async () => {
    const { session } = await seedActorWithForeignResource();
    const { status } = await invokeRouteWithParams(sessionRoute.GET, {
      method: "GET",
      params: { sessionId: session.id },
    });
    expect(status).toBe(404);
  });

  it("DELETE /api/sessions/[id] returns 404 for a foreign-org session", async () => {
    const { session } = await seedActorWithForeignResource();
    const { status } = await invokeRouteWithParams(sessionRoute.DELETE, {
      method: "DELETE",
      params: { sessionId: session.id },
    });
    expect(status).toBe(404);
    // Defence-in-depth: a regression that turned 404 into a successful delete
    // would still pass the status check above.
    expect(await prisma.session.findUnique({ where: { id: session.id } })).not.toBeNull();
  });

  it("GET /api/sessions/[id]/slices/[i]/events returns 404 for a foreign-org session", async () => {
    const { session } = await seedActorWithForeignResource();
    const { status } = await invokeRouteWithParams(sliceEventsRoute.GET, {
      method: "GET",
      params: { sessionId: session.id, sliceIndex: "0" },
    });
    expect(status).toBe(404);
  });

  it("GET /api/tracked-users/[id] returns 404 for a foreign-org tracked user", async () => {
    const { trackedUser } = await seedActorWithForeignResource();
    const { status } = await invokeRouteWithParams(trackedUserRoute.GET, {
      method: "GET",
      params: { userId: trackedUser.id },
    });
    expect(status).toBe(404);
  });

  it("GET /api/tracked-users/[id]/activity returns 404 for a foreign-org tracked user", async () => {
    const { trackedUser } = await seedActorWithForeignResource();
    const { status } = await invokeRouteWithParams(trackedUserActivityRoute.GET, {
      method: "GET",
      params: { userId: trackedUser.id },
    });
    expect(status).toBe(404);
  });

  it("GET /api/tracked-users/[id]/sessions returns 404 for a foreign-org tracked user", async () => {
    const { trackedUser } = await seedActorWithForeignResource();
    const { status } = await invokeRouteWithParams(trackedUserSessionsRoute.GET, {
      method: "GET",
      params: { userId: trackedUser.id },
    });
    expect(status).toBe(404);
  });

  it("GET /api/tracked-users/[id]/status returns 404 for a foreign-org tracked user", async () => {
    const { trackedUser } = await seedActorWithForeignResource();
    const { status } = await invokeRouteWithParams(trackedUserStatusRoute.GET, {
      method: "GET",
      params: { userId: trackedUser.id },
    });
    expect(status).toBe(404);
  });

  it("GET /api/tracked-users/[id]/timeline returns 404 for a foreign-org tracked user", async () => {
    const { trackedUser } = await seedActorWithForeignResource();
    const { status } = await invokeRouteWithParams(trackedUserTimelineRoute.GET, {
      method: "GET",
      params: { userId: trackedUser.id },
    });
    expect(status).toBe(404);
  });

  it("PATCH /api/tracked-users/[id]/display-name returns 404 for a foreign-org tracked user", async () => {
    const { trackedUser } = await seedActorWithForeignResource();
    const { status } = await invokeRouteWithParams(trackedUserDisplayNameRoute.PATCH, {
      method: "PATCH",
      body: { customName: "Hijack" },
      params: { userId: trackedUser.id },
    });
    expect(status).toBe(404);
    const refreshed = await prisma.trackedUser.findUnique({ where: { id: trackedUser.id } });
    // Defence-in-depth — write must not have landed.
    expect(refreshed?.customName).toBeNull();
  });

  it("returns 400 when the actor has no active org at all", async () => {
    const founder = await createUser();
    const actor = await createUser();
    const team = await createOrganization({ owner: founder });
    await createMembership({ user: actor, organization: team, role: "VIEWER" });
    const project = await createProject({ organization: team });
    const session = await createSession({ project });
    // Surfaced explicitly so the assertion's reason is unmistakable.
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: actor.id, activeOrganizationId: null })));

    const { status } = await invokeRouteWithParams(sessionRoute.GET, {
      method: "GET",
      params: { sessionId: session.id },
    });
    expect(status).toBe(400);
  });
});
