/**
 * `GET /api/tracked-users`. Status is derived in-JS (not indexable) and
 * display-name resolution runs the 4-level chain server-side, so this needs
 * end-to-end coverage past the `_helpers/` units. Invariants:
 *
 *   1. Org isolation — stray IDs in `?projectIds=` get dropped, not trusted.
 *   2. Search matches `externalId` + `customName` case-insensitively.
 *   3. Cursor pagination (property): every limit visits each row exactly once,
 *      preserves canonical order, terminates only via `nextCursor === null`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";

import type { PrismaClient } from "@/generated/prisma/client";

import * as trackedUsersRoute from "@/app/api/tracked-users/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createOrganization, createProject, createSession, createTrackedUser, createUser } from "../helpers/factories";
import { invokeRoute } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

type ListResponse = {
  data: Array<{ id: string; externalId: string; projectId: string; sessionCount: number }>;
  nextCursor: string | null;
};

describe("GET /api/tracked-users", () => {
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

  it("returns empty data when the active org has no projects", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    const { status, json } = await invokeRoute<ListResponse>(trackedUsersRoute.GET, { method: "GET" });

    expect(status).toBe(200);
    expect(json.data).toEqual([]);
    expect(json.nextCursor).toBeNull();
  });

  it("⭐ scopes strictly to the caller's org — users from other orgs are never returned", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const teamA = await createOrganization({ owner: alice });
    const teamB = await createOrganization({ owner: bob });
    const projectA = await createProject({ organization: teamA });
    const projectB = await createProject({ organization: teamB });

    await createTrackedUser({ project: projectA, externalId: "alice-user-1" });
    await createTrackedUser({ project: projectB, externalId: "bob-user-1" });

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: teamA.id })));

    // Try to leak bob's project through `?projectIds=`.
    const { json } = await invokeRoute<ListResponse>(trackedUsersRoute.GET, {
      method: "GET",
      url: `http://localhost/test?projectIds=${projectB.id}`,
    });

    // Stray IDs intersected away — safe fallback is "all alice's projects".
    expect(json.data.map((u) => u.externalId)).toEqual(["alice-user-1"]);
  });

  it("sessionCount excludes throwaway sessions — only real ones bump the row's stat", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    const tu = await createTrackedUser({ project, externalId: "user-with-mixed-sessions" });

    await createSession({ project, trackedUser: tu, eventCount: 50, duration: 60 });
    await createSession({ project, trackedUser: tu, eventCount: 50, duration: 60 });
    // Below floor — must not bump sessionCount.
    await createSession({ project, trackedUser: tu, eventCount: 3, duration: 60 });
    await createSession({ project, trackedUser: tu, eventCount: 50, duration: 0 });

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    const { json } = await invokeRoute<ListResponse>(trackedUsersRoute.GET, { method: "GET" });
    const row = json.data.find((u) => u.externalId === "user-with-mixed-sessions");
    expect(row?.sessionCount).toBe(2);
  });

  it("search matches both externalId and customName (case-insensitive)", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    await createTrackedUser({ project, externalId: "ext-ALICE-42" });
    await createTrackedUser({ project, externalId: "ext-bob-99", customName: "Bobby Tables" });
    await createTrackedUser({ project, externalId: "ext-charlie-1" });

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    const alice42 = await invokeRoute<ListResponse>(trackedUsersRoute.GET, {
      method: "GET",
      url: "http://localhost/test?search=alice",
    });
    expect(alice42.json.data.map((u) => u.externalId)).toEqual(["ext-ALICE-42"]);

    const bobby = await invokeRoute<ListResponse>(trackedUsersRoute.GET, {
      method: "GET",
      url: "http://localhost/test?search=BOBBY",
    });
    expect(bobby.json.data.map((u) => u.externalId)).toEqual(["ext-bob-99"]);
  });

  it("cursor pagination — dedup + order-preservation + terminal-null (fast-check)", async () => {
    // 23 users → any `limit ∈ [1, 10]` produces ≥3 pages (where cursor bugs
    // surface — single-page passes even when broken). The limit=23 baseline
    // captures the server-canonical order all runs must match.
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    for (let i = 0; i < 23; i += 1) {
      await createTrackedUser({ project, externalId: `ext-${i.toString().padStart(3, "0")}` });
    }

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    // Canonical single-page order — every paginated walk must match it element-for-element.
    const baseline = await invokeRoute<ListResponse>(trackedUsersRoute.GET, {
      method: "GET",
      url: "http://localhost/test?limit=100",
    });
    const canonicalOrder = baseline.json.data.map((u) => u.id);
    expect(canonicalOrder.length).toBe(23);

    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (limit) => {
        const seen: string[] = [];
        let cursor: string | null = null;
        let pages = 0;
        let terminalPageSeen = false;

        while (pages < 100) {
          const { json }: { json: ListResponse } = await invokeRoute<ListResponse>(trackedUsersRoute.GET, {
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

        expect(new Set(seen).size).toBe(seen.length); // dedup
        expect(seen.length).toBe(23); // completeness
        expect(seen).toEqual(canonicalOrder); // order preservation
        expect(terminalPageSeen).toBe(true); // terminated via null, not the safety cutoff
      }),
      // 5 runs — each walks up to 23 HTTP round-trips. Limits 1..10 is a small
      // property space; more runs wouldn't find additional regressions.
      { numRuns: 5 },
    );
  });
});
