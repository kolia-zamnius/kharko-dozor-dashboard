/**
 * `GET /api/sessions`. Asserts org scoping against `?projectIds=`, range
 * preset filtering, sort stability, and cursor invariants (dedup + order +
 * terminal-null) as a property — same pattern as `tracked-users-list`.
 *
 * Targets regressions that show WRONG data silently (cross-org leak, stale
 * rows, dupes) — not obviously-broken data (5xx, empty list). Combinations of
 * independent filter axes would explode for marginal signal.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";

import type { PrismaClient } from "@/generated/prisma/client";

import * as sessionsRoute from "@/app/api/sessions/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createOrganization, createProject, createSession, createUser } from "../helpers/factories";
import { invokeRoute } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

type ListResponse = {
  data: Array<{ id: string; externalId: string; projectId: string; duration: number; createdAt: string }>;
  nextCursor: string | null;
};

describe("GET /api/sessions", () => {
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

  it("⭐ cross-org isolation — another org's sessions are never returned", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const teamA = await createOrganization({ owner: alice });
    const teamB = await createOrganization({ owner: bob });
    const projectA = await createProject({ organization: teamA });
    const projectB = await createProject({ organization: teamB });

    await createSession({ project: projectA, externalId: "alice-sess-1" });
    await createSession({ project: projectB, externalId: "bob-sess-1" });

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: teamA.id })));

    const { json } = await invokeRoute<ListResponse>(sessionsRoute.GET, {
      method: "GET",
      // Try to leak Bob's project through `?projectIds=`.
      url: `http://localhost/test?projectIds=${projectB.id}`,
    });

    // Stray project IDs are intersected away; safe fallback is "all my projects".
    expect(json.data.map((s) => s.externalId)).toEqual(["alice-sess-1"]);
  });

  it("date-range filter excludes sessions older than the preset window", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });

    const now = new Date();
    const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    await createSession({ project, externalId: "recent", createdAt: twoDaysAgo });
    await createSession({ project, externalId: "ancient", createdAt: thirtyFiveDaysAgo });

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    const { json } = await invokeRoute<ListResponse>(sessionsRoute.GET, {
      method: "GET",
      url: "http://localhost/test?range=7d",
    });

    expect(json.data.map((s) => s.externalId)).toEqual(["recent"]);
  });

  it("search matches externalId case-insensitively", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    await createSession({ project, externalId: "SESS-alpha-1" });
    await createSession({ project, externalId: "sess-beta-2" });

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    const { json } = await invokeRoute<ListResponse>(sessionsRoute.GET, {
      method: "GET",
      url: "http://localhost/test?search=ALPHA",
    });
    expect(json.data.map((s) => s.externalId)).toEqual(["SESS-alpha-1"]);
  });

  it("cursor pagination — dedup + order-preservation + terminal-null (fast-check)", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });

    // 17 sessions, staggered createdAt so the default `createdAt desc` has a stable order.
    const baseTime = Date.now();
    for (let i = 0; i < 17; i += 1) {
      await createSession({
        project,
        externalId: `s-${i.toString().padStart(3, "0")}`,
        createdAt: new Date(baseTime - i * 1000),
      });
    }

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    // Canonical single-page baseline.
    const baseline = await invokeRoute<ListResponse>(sessionsRoute.GET, {
      method: "GET",
      url: "http://localhost/test?limit=100",
    });
    const canonicalOrder = baseline.json.data.map((s) => s.id);
    expect(canonicalOrder.length).toBe(17);

    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), async (limit) => {
        const seen: string[] = [];
        let cursor: string | null = null;
        let pages = 0;
        let terminalPageSeen = false;

        while (pages < 50) {
          const { json }: { json: ListResponse } = await invokeRoute<ListResponse>(sessionsRoute.GET, {
            method: "GET",
            url: `http://localhost/test?limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`,
          });

          for (const row of json.data) seen.push(row.id);
          pages += 1;

          if (json.nextCursor === null) {
            terminalPageSeen = true;
            break;
          }
          cursor = json.nextCursor;
        }

        expect(new Set(seen).size).toBe(seen.length);
        expect(seen.length).toBe(17);
        expect(seen).toEqual(canonicalOrder);
        expect(terminalPageSeen).toBe(true);
      }),
      { numRuns: 5 },
    );
  });
});
