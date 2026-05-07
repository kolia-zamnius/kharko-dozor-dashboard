/**
 * `GET /api/cron/daily-cleanup`. Bearer-token auth (`CRON_SECRET`) — not
 * `withAuth`, so `mockAuth` is unused even though shared setup installs it.
 * Seeds each of the four cleanup steps in isolation and asserts both the
 * counter AND the DB side effect (row count + cascaded children).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as cronRoute from "@/app/api/cron/daily-cleanup/route";
import { SESSION_RETENTION_DAYS, ONE_DAY_MS } from "@/lib/time";

import { getTestPrisma, truncateAll } from "../helpers/db";
import {
  createInvite,
  createOrganization,
  createProject,
  createSession,
  createTrackedUser,
  createUser,
} from "../helpers/factories";

const EXPECTED_BEARER = "Bearer test-cron-secret";

describe("GET /api/cron/daily-cleanup", () => {
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

  it("returns 401 when the Bearer token is missing or wrong (with CRON_SECRET set)", async () => {
    const reqMissing = new Request("http://localhost/api/cron/daily-cleanup", { method: "GET" });
    expect((await cronRoute.GET(reqMissing)).status).toBe(401);

    const reqWrong = new Request("http://localhost/api/cron/daily-cleanup", {
      method: "GET",
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect((await cronRoute.GET(reqWrong)).status).toBe(401);
  });

  it("deletes expired PENDING invites past their TTL", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const fresh = await createInvite({
      organization: team,
      email: "fresh@test.local",
      invitedBy: alice,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
    });
    const expired = await createInvite({
      organization: team,
      email: "stale@test.local",
      invitedBy: alice,
      expiresAt: new Date(Date.now() - 1_000),
    });

    const req = new Request("http://localhost/api/cron/daily-cleanup", {
      method: "GET",
      headers: { authorization: EXPECTED_BEARER },
    });
    const response = await cronRoute.GET(req);
    const summary = (await response.json()) as { invites: number };

    expect(response.status).toBe(200);
    expect(summary.invites).toBe(1);
    expect(await prisma.invite.findUnique({ where: { id: fresh.id } })).not.toBeNull();
    expect(await prisma.invite.findUnique({ where: { id: expired.id } })).toBeNull();
  });

  it("deletes sessions older than SESSION_RETENTION_DAYS (cascades event-batches + markers)", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    const recent = await createSession({ project });
    const stale = await createSession({
      project,
      createdAt: new Date(Date.now() - (SESSION_RETENTION_DAYS + 1) * ONE_DAY_MS),
    });

    const req = new Request("http://localhost/api/cron/daily-cleanup", {
      method: "GET",
      headers: { authorization: EXPECTED_BEARER },
    });
    const response = await cronRoute.GET(req);
    const summary = (await response.json()) as { sessions: number };

    expect(summary.sessions).toBe(1);
    expect(await prisma.session.findUnique({ where: { id: recent.id } })).not.toBeNull();
    expect(await prisma.session.findUnique({ where: { id: stale.id } })).toBeNull();
  });

  it("deletes orphan TrackedUsers (no remaining sessions)", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    const orphan = await createTrackedUser({ project, externalId: "orphan" });
    const kept = await createTrackedUser({ project, externalId: "kept" });
    await createSession({ project, trackedUser: kept });

    const req = new Request("http://localhost/api/cron/daily-cleanup", {
      method: "GET",
      headers: { authorization: EXPECTED_BEARER },
    });
    const response = await cronRoute.GET(req);
    const summary = (await response.json()) as { trackedUsers: number };

    expect(summary.trackedUsers).toBe(1);
    expect(await prisma.trackedUser.findUnique({ where: { id: orphan.id } })).toBeNull();
    expect(await prisma.trackedUser.findUnique({ where: { id: kept.id } })).not.toBeNull();
  });

  it("deletes empty organisations and nulls out referring activeOrganizationId", async () => {
    const alice = await createUser();
    const personal = await createOrganization({ owner: alice, type: "PERSONAL" });
    const empty = await createOrganization({ owner: alice, type: "TEAM" });
    await prisma.membership.deleteMany({ where: { organizationId: empty.id } });
    await prisma.user.update({
      where: { id: alice.id },
      data: { activeOrganizationId: empty.id },
    });

    const req = new Request("http://localhost/api/cron/daily-cleanup", {
      method: "GET",
      headers: { authorization: EXPECTED_BEARER },
    });
    const response = await cronRoute.GET(req);
    const summary = (await response.json()) as { organizations: number };

    expect(summary.organizations).toBe(1);
    expect(await prisma.organization.findUnique({ where: { id: empty.id } })).toBeNull();
    expect(await prisma.organization.findUnique({ where: { id: personal.id } })).not.toBeNull();

    const aliceAfter = await prisma.user.findUnique({ where: { id: alice.id } });
    expect(aliceAfter?.activeOrganizationId).toBeNull();
  });

  it("returns a full summary with zeros when nothing is stale", async () => {
    const req = new Request("http://localhost/api/cron/daily-cleanup", {
      method: "GET",
      headers: { authorization: EXPECTED_BEARER },
    });
    const response = await cronRoute.GET(req);
    const summary = (await response.json()) as {
      throwawaySessions: number;
      invites: number;
      sessions: number;
      trackedUsers: number;
      organizations: number;
    };

    expect(response.status).toBe(200);
    expect(summary).toEqual({ throwawaySessions: 0, invites: 0, sessions: 0, trackedUsers: 0, organizations: 0 });
  });

  it("deletes throwaway sessions (eventCount < floor OR duration < floor) — keeping real ones intact", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });

    const real = await createSession({ project, eventCount: 50, duration: 60 });
    const tooFewEvents = await createSession({ project, eventCount: 3, duration: 60 });
    const tooShort = await createSession({ project, eventCount: 50, duration: 0 });
    const both = await createSession({ project, eventCount: 1, duration: 0 });

    const req = new Request("http://localhost/api/cron/daily-cleanup", {
      method: "GET",
      headers: { authorization: EXPECTED_BEARER },
    });
    const response = await cronRoute.GET(req);
    const summary = (await response.json()) as { throwawaySessions: number };

    expect(response.status).toBe(200);
    expect(summary.throwawaySessions).toBe(3);

    const remaining = await prisma.session.findMany({ where: { projectId: project.id }, select: { id: true } });
    const remainingIds = remaining.map((r) => r.id).sort();
    expect(remainingIds).toEqual([real.id].sort());
    // Sanity: throwaway IDs are gone.
    for (const dropped of [tooFewEvents, tooShort, both]) {
      expect(remainingIds).not.toContain(dropped.id);
    }
  });
});
