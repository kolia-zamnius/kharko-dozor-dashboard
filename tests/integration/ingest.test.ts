/**
 * `/api/ingest` — the only external contract shared with the published
 * `@kharko/dozor` SDK, so behaviour must stay identical across releases. Full
 * pipeline: public-key auth → body parse (gzip-aware) → session upsert →
 * slice markers → event insert → CORS response.
 */

import { gzipSync } from "node:zlib";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as ingestRoute from "@/app/api/ingest/route";

import { PUBLIC_KEY_CORS_HEADERS } from "@/app/api/_lib/cors";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createOrganization, createProject, createUser } from "../helpers/factories";

type IngestPayload = {
  sessionId: string;
  events: Array<{ type: number; data: unknown; timestamp: number; sliceIndex?: number }>;
  metadata?: {
    url: string;
    referrer: string;
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
    language: string;
    userIdentity?: { userId: string; traits?: Record<string, unknown> };
  };
  sliceMarkers?: Array<{
    index: number;
    reason: "init" | "idle" | "navigation";
    startedAt: number;
    url: string;
    pathname: string;
  }>;
};

function samplePayload(): IngestPayload {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  return {
    sessionId,
    events: [
      { type: 4, data: { href: "https://example.com" }, timestamp: now, sliceIndex: 0 },
      { type: 2, data: { node: {} }, timestamp: now + 50, sliceIndex: 0 },
      { type: 3, data: { source: 1, x: 100, y: 100 }, timestamp: now + 100, sliceIndex: 0 },
    ],
    metadata: {
      url: "https://example.com/",
      referrer: "",
      userAgent: "test-agent/1.0",
      screenWidth: 1920,
      screenHeight: 1080,
      language: "en-US",
    },
    sliceMarkers: [{ index: 0, reason: "init", startedAt: now, url: "https://example.com/", pathname: "/" }],
  };
}

function expectCorsHeaders(response: Response): void {
  for (const [key, value] of Object.entries(PUBLIC_KEY_CORS_HEADERS)) {
    expect(response.headers.get(key)).toBe(value);
  }
}

describe("POST /api/ingest", () => {
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

  it("creates a Session + EventBatch + initial url Marker for a valid batch", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    const payload = samplePayload();

    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      headers: {
        "X-Dozor-Public-Key": project.key,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const response = await ingestRoute.POST(req);

    expect(response.status).toBe(204);
    expectCorsHeaders(response);

    const session = await prisma.session.findUnique({
      where: { projectId_externalId: { projectId: project.id, externalId: payload.sessionId } },
    });
    expect(session).not.toBeNull();

    const batches = await prisma.eventBatch.findMany({ where: { sessionId: session!.id } });
    expect(batches).toHaveLength(1);
    expect(batches[0]?.eventCount).toBe(3);

    const markers = await prisma.marker.findMany({
      where: { sessionId: session!.id, kind: "url" },
    });
    expect(markers.length).toBeGreaterThanOrEqual(1);
  });

  it("decompresses a gzip batch transparently", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    const payload = samplePayload();
    const gz = gzipSync(JSON.stringify(payload));

    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      headers: {
        "X-Dozor-Public-Key": project.key,
        "content-type": "application/json",
        "content-encoding": "gzip",
      },
      // Plain Uint8Array — Node's fetch rejects bare Buffer as BodyInit in strict runtimes.
      body: new Uint8Array(gz),
    });
    const response = await ingestRoute.POST(req);

    expect(response.status).toBe(204);
    const session = await prisma.session.findUnique({
      where: { projectId_externalId: { projectId: project.id, externalId: payload.sessionId } },
    });
    expect(session).not.toBeNull();
  });

  it("links a TrackedUser when metadata carries userIdentity", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });

    const payload = samplePayload();
    payload.metadata!.userIdentity = { userId: "ext-user-42", traits: { email: "u@example.com" } };

    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      headers: {
        "X-Dozor-Public-Key": project.key,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const response = await ingestRoute.POST(req);

    expect(response.status).toBe(204);
    const tracked = await prisma.trackedUser.findUnique({
      where: { projectId_externalId: { projectId: project.id, externalId: "ext-user-42" } },
    });
    expect(tracked).not.toBeNull();
    const session = await prisma.session.findUnique({
      where: { projectId_externalId: { projectId: project.id, externalId: payload.sessionId } },
    });
    expect(session?.trackedUserId).toBe(tracked?.id);
  });

  it("returns 401 (+ CORS) for an unknown public key — no existence oracle", async () => {
    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      headers: {
        "X-Dozor-Public-Key": "dp_bogus0000000000000000000000000000",
        "content-type": "application/json",
      },
      body: JSON.stringify(samplePayload()),
    });
    const response = await ingestRoute.POST(req);
    expect(response.status).toBe(401);
    expectCorsHeaders(response);
  });

  it("returns 401 (+ CORS) when the X-Dozor-Public-Key header is missing", async () => {
    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(samplePayload()),
    });
    const response = await ingestRoute.POST(req);
    expect(response.status).toBe(401);
    expectCorsHeaders(response);
  });

  it("returns 400 (+ CORS) for a malformed batch (zod rejection)", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });

    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      headers: {
        "X-Dozor-Public-Key": project.key,
        "content-type": "application/json",
      },
      body: JSON.stringify({ sessionId: "not-a-uuid", events: [] }),
    });
    const response = await ingestRoute.POST(req);
    expect(response.status).toBe(400);
    expectCorsHeaders(response);
  });

  it("bumps Project.lastUsedAt on a successful batch", async () => {
    const alice = await createUser();
    const team = await createOrganization({ owner: alice });
    const project = await createProject({ organization: team });
    expect(project.lastUsedAt).toBeNull();

    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      headers: {
        "X-Dozor-Public-Key": project.key,
        "content-type": "application/json",
      },
      body: JSON.stringify(samplePayload()),
    });
    await ingestRoute.POST(req);

    // `lastUsedAt` is fire-and-forget — awaiting the response doesn't guarantee
    // commit. 100ms is the cheapest reliable wait for the orphan update.
    await new Promise((r) => setTimeout(r, 100));

    const refreshed = await prisma.project.findUnique({ where: { id: project.id } });
    expect(refreshed?.lastUsedAt).not.toBeNull();
  });
});

describe("OPTIONS /api/ingest (CORS preflight)", () => {
  it("returns 204 + CORS headers without authentication", async () => {
    const response = ingestRoute.OPTIONS();
    expect(response.status).toBe(204);
    expectCorsHeaders(response);
  });
});
