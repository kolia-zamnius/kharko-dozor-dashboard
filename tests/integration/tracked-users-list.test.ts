/**
 * Integration tests for `GET /api/tracked-users` — the primary users list.
 *
 * @remarks
 * This route has dedicated `_helpers/` for enrich / filter / sort because
 * the logic is more than CRUD: status is derived in-JS (not indexable),
 * display-name resolution runs server-side via the 4-level chain, and
 * the result feeds a paginated table with URL-driven filters. That
 * complexity deserves end-to-end coverage, not just unit tests on the
 * helpers.
 *
 * Invariants asserted here:
 *   1. **Org isolation** — users from orgs the caller doesn't belong to
 *      are NEVER returned, even if `?projectIds=` explicitly names
 *      their project (stray IDs are dropped, not trusted).
 *   2. **Search** matches both `externalId` and `customName` case-insensitively.
 *   3. **Cursor pagination** — stronger than "dedup": iterating through
 *      pages with any valid limit (a) visits each row exactly once,
 *      (b) returns `nextCursor === null` ONLY on the final page, and
 *      (c) preserves the server's canonical order across pages.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";

import type { PrismaClient } from "@/generated/prisma/client";

import * as trackedUsersRoute from "@/app/api/tracked-users/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createOrganization, createProject, createTrackedUser, createUser } from "../helpers/factories";
import { invokeRoute } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

type ListResponse = {
  data: Array<{ id: string; externalId: string; projectId: string }>;
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

    // Attempt to leak bob's project through the ?projectIds= query param.
    const { json } = await invokeRoute<ListResponse>(trackedUsersRoute.GET, {
      method: "GET",
      url: `http://localhost/test?projectIds=${projectB.id}`,
    });

    // Route intersects `?projectIds=` with org-owned projects — stray IDs
    // are dropped, not honoured. The request falls back to "all alice's
    // projects" (the safe default), not "bob's project".
    expect(json.data.map((u) => u.externalId)).toEqual(["alice-user-1"]);
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
    // 23 users → any `limit ∈ [1, 10]` produces at least 3 pages, which is
    // where cursor bugs typically surface (single-page passes even when
    // broken). The "expected order" is captured once with limit=23 as the
    // server-canonical baseline all runs must match.
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    for (let i = 0; i < 23; i += 1) {
      await createTrackedUser({ project, externalId: `ext-${i.toString().padStart(3, "0")}` });
    }

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id, activeOrganizationId: team.id })));

    // Canonical single-page order — the reference against which every
    // paginated walk must match, element-for-element.
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

        // 1. Dedup — every id appears exactly once.
        expect(new Set(seen).size).toBe(seen.length);
        // 2. Completeness — every seeded row was visited.
        expect(seen.length).toBe(23);
        // 3. Order — pagination preserves the single-page canonical order.
        expect(seen).toEqual(canonicalOrder);
        // 4. Terminal — nextCursor === null was observed (loop exited cleanly,
        //    not via the 100-page safety cutoff).
        expect(terminalPageSeen).toBe(true);
      }),
      // 5 runs — each walks up to 23 HTTP round-trips against real Postgres.
      // The property space is small (limits 1..10); more runs wouldn't find
      // additional regressions.
      { numRuns: 5 },
    );
  });
});
