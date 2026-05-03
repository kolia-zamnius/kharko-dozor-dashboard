/**
 * `POST /api/sessions/cancel` — SDK `stop()` teardown path. Public-key route
 * with a mutating side-effect (hard-delete + cascades). Security invariants:
 *
 *   1. No existence oracle — unknown/missing key both return 401 + CORS.
 *   2. `(projectId, externalId)` scoping — project A's key cannot cancel
 *      project B's session even if the caller knows the external ID.
 *   3. Race-safe no-op — cancel arriving before the first ingest creates the
 *      row returns 204 (not 404). The SDK legitimately races; 404 would spam
 *      Sentry for normal traffic.
 *
 * OPTIONS preflight covered so the CORS contract stays honest.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as cancelRoute from "@/app/api/sessions/cancel/route";
import { PUBLIC_KEY_CORS_HEADERS } from "@/app/api/_lib/cors";

import { getTestPrisma, truncateAll } from "../helpers/db";
import { createOrganization, createProject, createUser } from "../helpers/factories";

function expectCorsHeaders(response: Response): void {
  for (const [key, expected] of Object.entries(PUBLIC_KEY_CORS_HEADERS)) {
    expect(response.headers.get(key)).toBe(expected);
  }
}

describe("POST /api/sessions/cancel", () => {
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

  it("hard-deletes the session row for a valid key + existing session", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });

    // `sessionId` is the SDK external UUID, not the DB id — and the factory's
    // default `sess-<uuid>` prefix would fail `z.uuid()`.
    const externalId = crypto.randomUUID();
    const session = await prisma.session.create({
      data: { externalId, projectId: project.id, startedAt: new Date() },
    });

    const req = new Request("http://localhost/api/sessions/cancel", {
      method: "POST",
      headers: { "X-Dozor-Public-Key": project.key, "content-type": "application/json" },
      body: JSON.stringify({ sessionId: externalId }),
    });
    const response = await cancelRoute.POST(req);

    expect(response.status).toBe(204);
    expectCorsHeaders(response);

    const gone = await prisma.session.findUnique({ where: { id: session.id } });
    expect(gone).toBeNull();
  });

  it("returns 204 without mutation when no matching session exists (race-safe)", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });

    const req = new Request("http://localhost/api/sessions/cancel", {
      method: "POST",
      headers: { "X-Dozor-Public-Key": project.key, "content-type": "application/json" },
      body: JSON.stringify({ sessionId: crypto.randomUUID() }),
    });
    const response = await cancelRoute.POST(req);

    expect(response.status).toBe(204);
  });

  it("⭐ does NOT delete a session belonging to a different project (cross-tenant scoping)", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const teamA = await createOrganization({ owner: alice });
    const teamB = await createOrganization({ owner: bob });
    const projectA = await createProject({ organization: teamA });
    const projectB = await createProject({ organization: teamB });

    const externalId = crypto.randomUUID();
    const session = await prisma.session.create({
      data: { externalId, projectId: projectB.id, startedAt: new Date() },
    });

    // Attacker has projectA's key, knows projectB's session UUID.
    const req = new Request("http://localhost/api/sessions/cancel", {
      method: "POST",
      headers: { "X-Dozor-Public-Key": projectA.key, "content-type": "application/json" },
      body: JSON.stringify({ sessionId: externalId }),
    });
    const response = await cancelRoute.POST(req);

    // 204 not 404 — miss-on-my-project ≡ absent, otherwise cross-tenant keys
    // would have an existence oracle. The other project's row stays untouched.
    expect(response.status).toBe(204);

    const stillThere = await prisma.session.findUnique({ where: { id: session.id } });
    expect(stillThere).not.toBeNull();
  });

  it("returns 401 + CORS for an unknown public key", async () => {
    const req = new Request("http://localhost/api/sessions/cancel", {
      method: "POST",
      headers: {
        "X-Dozor-Public-Key": "dp_bogus0000000000000000000000000000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ sessionId: crypto.randomUUID() }),
    });
    const response = await cancelRoute.POST(req);
    expect(response.status).toBe(401);
    expectCorsHeaders(response);
  });

  it("returns 401 + CORS when the X-Dozor-Public-Key header is missing", async () => {
    const req = new Request("http://localhost/api/sessions/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: crypto.randomUUID() }),
    });
    const response = await cancelRoute.POST(req);
    expect(response.status).toBe(401);
    expectCorsHeaders(response);
  });

  it("returns 400 + CORS when sessionId is missing or not a UUID (zod rejection)", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });

    const req = new Request("http://localhost/api/sessions/cancel", {
      method: "POST",
      headers: { "X-Dozor-Public-Key": project.key, "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "not-a-uuid" }),
    });
    const response = await cancelRoute.POST(req);
    expect(response.status).toBe(400);
    expectCorsHeaders(response);
  });

  it("OPTIONS preflight → 204 + CORS", async () => {
    const response = cancelRoute.OPTIONS();
    expect(response.status).toBe(204);
    expectCorsHeaders(response);
  });
});
