/**
 * Unit tests for the `withAuth` HOF.
 *
 * @remarks
 * Covers every branch of the error boundary:
 *   - anonymous → 401 (no `auth()`-returned session)
 *   - authenticated success → handler result passes through
 *   - `HttpError` → mapped status + body
 *   - `ZodError` → 400 + localised message + issues
 *   - other exception → rethrows (Next mounts its own error boundary)
 *   - dynamic params → awaited and passed to the handler
 *
 * Mocks: `@/server/auth` for the session, `next-intl/server` for the
 * locale translator the ZodError branch awaits.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { getTranslations } from "next-intl/server";
import { z, ZodError } from "zod";

// NextAuth v5's `auth()` is overloaded (middleware variant + session getter).
// `vi.mocked(auth)` picks the first overload (middleware) which defeats
// `mockResolvedValue(sessionObject)` at the type level. `vi.hoisted` lets
// us declare a strongly-typed mock, hoist it above `vi.mock`, and still
// reference it in tests with `mockResolvedValue` / `mockReset` semantics.
const { mockedAuth } = vi.hoisted(() => ({
  mockedAuth: vi.fn<() => Promise<Session | null>>(),
}));

vi.mock("@/server/auth", () => ({
  auth: mockedAuth,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const t = (key: string) => key;
    return t as unknown as Awaited<ReturnType<typeof getTranslations>>;
  }),
}));

import { HttpError } from "@/server/http-error";
import { buildSession, buildSessionUser } from "../../../../tests/helpers/auth-mock";
import { invokeRoute } from "../../../../tests/helpers/invoke-route";

import { withAuth } from "./with-auth";

describe("withAuth", () => {
  afterEach(() => {
    mockedAuth.mockReset();
  });

  it("returns 401 when auth() resolves to null", async () => {
    mockedAuth.mockResolvedValue(null);

    const handler = withAuth(async () => new Response("should-not-run"));
    const { status, json } = await invokeRoute<{ error: string }>(handler, { method: "GET" });

    expect(status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 when auth() resolves to a session without user.id", async () => {
    // Session envelope without `user.id` (e.g. mid-migration edge case).
    mockedAuth.mockResolvedValue({
      user: { id: "" },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as unknown as Session);

    const handler = withAuth(async () => new Response("should-not-run"));
    const { status } = await invokeRoute(handler, { method: "GET" });
    expect(status).toBe(401);
  });

  it("invokes the handler with the session user on success", async () => {
    const user = buildSessionUser({ id: "user_1" });
    mockedAuth.mockResolvedValue(buildSession(user));

    const handler = withAuth(async (_req, u) => Response.json({ echo: u.id }, { status: 200 }));
    const { status, json } = await invokeRoute<{ echo: string }>(handler, { method: "GET" });

    expect(status).toBe(200);
    expect(json.echo).toBe("user_1");
  });

  it("awaits dynamic params and passes them to the handler", async () => {
    const user = buildSessionUser({ id: "user_1" });
    mockedAuth.mockResolvedValue(buildSession(user));

    const handler = withAuth<{ orgId: string }>(async (_req, _u, params) =>
      Response.json({ orgId: params.orgId }, { status: 200 }),
    );
    // Params-handler invocation — built inline because `invokeRoute` only
    // covers the no-params shape (TS Promise variance prevents a single
    // helper signature from accepting both). Five lines here is less
    // friction than a generic-heavy helper overload.
    const req = new Request("http://localhost/test", { method: "GET" });
    const response = await handler(req, { params: Promise.resolve({ orgId: "org_42" }) });
    const json = (await response.json()) as { orgId: string };

    expect(response.status).toBe(200);
    expect(json.orgId).toBe("org_42");
  });

  it("maps HttpError(status, message) to matching JSON response", async () => {
    const user = buildSessionUser({ id: "user_1" });
    mockedAuth.mockResolvedValue(buildSession(user));

    const handler = withAuth(async () => {
      throw new HttpError(403, "Insufficient permissions");
    });
    const { status, json } = await invokeRoute<{ error: string }>(handler, { method: "GET" });

    expect(status).toBe(403);
    expect(json.error).toBe("Insufficient permissions");
  });

  it("maps ZodError to 400 + localised message + issues array", async () => {
    const user = buildSessionUser({ id: "user_1" });
    mockedAuth.mockResolvedValue(buildSession(user));

    const handler = withAuth(async () => {
      // Simulate a route handler that hand-parses and re-throws.
      const schema = z.object({ email: z.email() });
      schema.parse({ email: "bogus" });
      return new Response("unreachable");
    });
    const { status, json } = await invokeRoute<{ error: string; issues: unknown[] }>(handler, {
      method: "POST",
      body: { email: "bogus" },
    });

    expect(status).toBe(400);
    expect(json.error).toMatch(/^email: /);
    expect(Array.isArray(json.issues)).toBe(true);
    expect(json.issues.length).toBeGreaterThan(0);
  });

  it("rethrows unknown exceptions so Next mounts its own error boundary", async () => {
    const user = buildSessionUser({ id: "user_1" });
    mockedAuth.mockResolvedValue(buildSession(user));

    const handler = withAuth(async () => {
      throw new Error("db connection lost");
    });

    await expect(invokeRoute(handler, { method: "GET" })).rejects.toThrow(/db connection lost/);
  });

  it("does NOT accidentally wrap a non-ZodError instance of Error as 400", async () => {
    // Sanity: the `err instanceof ZodError` branch must be exact, not
    // a structural `"issues" in err` sniff. This guard catches a
    // regression where a future refactor broadens the branch.
    const user = buildSessionUser({ id: "user_1" });
    mockedAuth.mockResolvedValue(buildSession(user));

    class NotAZodError extends Error {
      issues = [{ path: ["foo"], message: "nope" }];
    }

    const handler = withAuth(async () => {
      throw new NotAZodError("fake");
    });

    await expect(invokeRoute(handler, { method: "GET" })).rejects.toThrow(/fake/);
  });

  it("handles a thrown ZodError instance directly (not just from parse)", async () => {
    const user = buildSessionUser({ id: "user_1" });
    mockedAuth.mockResolvedValue(buildSession(user));

    const handler = withAuth(async () => {
      throw new ZodError([
        {
          code: "custom",
          path: ["field"],
          message: "bespoke",
          input: undefined,
        },
      ]);
    });
    const { status, json } = await invokeRoute<{ error: string }>(handler, { method: "POST" });
    expect(status).toBe(400);
    expect(json.error).toContain("field");
  });
});
