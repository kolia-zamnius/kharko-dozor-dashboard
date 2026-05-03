/**
 * Security invariants:
 *   - Missing header + unknown key both return 401 — no existence oracle.
 *   - CORS on every response (success + error), so a browser SDK gets a
 *     parseable error instead of an opaque CORS failure.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { getTranslations } from "next-intl/server";
import { z, ZodError } from "zod";

vi.mock("@/server/db/client", () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const t = (key: string) => key;
    return t as unknown as Awaited<ReturnType<typeof getTranslations>>;
  }),
}));

import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { invokeRoute } from "../../../../tests/helpers/invoke-route";

import { PUBLIC_KEY_CORS_HEADERS } from "./cors";
import { withPublicKey } from "./with-public-key";

const mockedFindUnique = vi.mocked(prisma.project.findUnique);

function expectCorsHeaders(response: Response): void {
  for (const [key, value] of Object.entries(PUBLIC_KEY_CORS_HEADERS)) {
    expect(response.headers.get(key)).toBe(value);
  }
}

describe("withPublicKey", () => {
  afterEach(() => {
    mockedFindUnique.mockReset();
  });

  it("returns 401 (+ CORS) when X-Dozor-Public-Key header is missing", async () => {
    const handler = withPublicKey(async () => new Response("should-not-run"));
    const { response, status, json } = await invokeRoute<{ error: string }>(handler, {
      method: "POST",
    });

    expect(status).toBe(401);
    expect(json.error).toMatch(/X-Dozor-Public-Key/);
    expectCorsHeaders(response);
  });

  it("returns 401 (+ CORS) when the public key doesn't resolve to a project", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const handler = withPublicKey(async () => new Response("should-not-run"));
    const { response, status, json } = await invokeRoute<{ error: string }>(handler, {
      method: "POST",
      headers: { "X-Dozor-Public-Key": "dp_unknown_key" },
    });

    expect(status).toBe(401);
    expect(json.error).toBe("Invalid API key");
    expectCorsHeaders(response);
  });

  it("invokes the handler and applies CORS on success", async () => {
    mockedFindUnique.mockResolvedValue({ id: "proj_1" } as Awaited<ReturnType<typeof prisma.project.findUnique>>);

    const handler = withPublicKey(async ({ project }) => Response.json({ id: project.id }, { status: 200 }));
    const { response, status, json } = await invokeRoute<{ id: string }>(handler, {
      method: "POST",
      headers: { "X-Dozor-Public-Key": "dp_good_key" },
    });

    expect(status).toBe(200);
    expect(json.id).toBe("proj_1");
    expectCorsHeaders(response);
  });

  it("maps HttpError (+ CORS) when the handler throws", async () => {
    mockedFindUnique.mockResolvedValue({ id: "proj_1" } as Awaited<ReturnType<typeof prisma.project.findUnique>>);

    const handler = withPublicKey(async () => {
      throw new HttpError(409, "Idempotency conflict");
    });
    const { response, status, json } = await invokeRoute<{ error: string }>(handler, {
      method: "POST",
      headers: { "X-Dozor-Public-Key": "dp_good_key" },
    });

    expect(status).toBe(409);
    expect(json.error).toBe("Idempotency conflict");
    expectCorsHeaders(response);
  });

  it("maps ZodError to 400 (+ CORS + localised message)", async () => {
    mockedFindUnique.mockResolvedValue({ id: "proj_1" } as Awaited<ReturnType<typeof prisma.project.findUnique>>);

    const handler = withPublicKey(async () => {
      const schema = z.object({ url: z.url() });
      schema.parse({ url: "not-a-url" });
      return new Response("unreachable");
    });
    const { response, status, json } = await invokeRoute<{ error: string }>(handler, {
      method: "POST",
      headers: { "X-Dozor-Public-Key": "dp_good_key" },
    });

    expect(status).toBe(400);
    expect(json.error).toContain("url");
    expectCorsHeaders(response);
  });

  it("rethrows unknown exceptions so Next mounts its own boundary", async () => {
    mockedFindUnique.mockResolvedValue({ id: "proj_1" } as Awaited<ReturnType<typeof prisma.project.findUnique>>);

    const handler = withPublicKey(async () => {
      throw new Error("unexpected");
    });

    await expect(
      invokeRoute(handler, { method: "POST", headers: { "X-Dozor-Public-Key": "dp_good_key" } }),
    ).rejects.toThrow(/unexpected/);
  });

  it("also maps thrown ZodError instances (not just parse failures)", async () => {
    mockedFindUnique.mockResolvedValue({ id: "proj_1" } as Awaited<ReturnType<typeof prisma.project.findUnique>>);

    const handler = withPublicKey(async () => {
      throw new ZodError([
        {
          code: "custom",
          path: ["field"],
          message: "bespoke",
          input: undefined,
        },
      ]);
    });
    const { response, status } = await invokeRoute(handler, {
      method: "POST",
      headers: { "X-Dozor-Public-Key": "dp_good_key" },
    });

    expect(status).toBe(400);
    expectCorsHeaders(response);
  });
});
