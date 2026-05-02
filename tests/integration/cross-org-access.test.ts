/**
 * Integration tests for the cross-organization access guard.
 *
 * @remarks
 * The motivating bug: a user who belongs to two orgs (A active, B
 * background) could open a `/users/{id}` or `/replays/{id}` URL whose
 * resource was actually in B and see B's data while the dashboard chrome
 * still showed A. Backend now enforces "resource must be in the active
 * org" via `requireResourceAccess`, returning an opaque 404 (never 403)
 * so a guessed ID never confirms its existence to a foreign-org member.
 *
 * Each route below is exercised twice in spirit: the cross-org case
 * (covered here, expects 404) and the same-org case (covered in the
 * route's own test file, expects 200/204). Keeping the cross-org axis
 * in one file makes it obvious which routes opted in to the guard and
 * which were missed if the helper is rolled out further.
 *
 * @see src/server/auth/permissions.ts — `requireResourceAccess`
 * @see tests/integration/permissions-matrix.test.ts — RBAC drift detector
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

  /**
   * Seed an actor who is a member of two orgs (A and B). The active org
   * is A. The resource (session + tracked user) lives in B. The guard
   * must refuse the request even though membership in B technically
   * exists — what matters is the *active* org at request time.
   */
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
    // Defence-in-depth: ensure the row is still present after the failed
    // delete — a regression that downgraded 404 to a successful delete
    // would otherwise pass the status check above.
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
    // Defence-in-depth: the write must not have landed.
    expect(refreshed?.customName).toBeNull();
  });

  it("returns 400 when the actor has no active org at all", async () => {
    const founder = await createUser();
    const actor = await createUser();
    const team = await createOrganization({ owner: founder });
    await createMembership({ user: actor, organization: team, role: "VIEWER" });
    const project = await createProject({ organization: team });
    const session = await createSession({ project });
    // `activeOrganizationId: null` is the default — surfaced explicitly
    // so the assertion's reason is impossible to misread.
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: actor.id, activeOrganizationId: null })));

    const { status } = await invokeRouteWithParams(sessionRoute.GET, {
      method: "GET",
      params: { sessionId: session.id },
    });
    expect(status).toBe(400);
  });
});
