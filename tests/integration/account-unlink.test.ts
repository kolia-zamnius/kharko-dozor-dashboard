/**
 * Integration tests for `DELETE /api/user/accounts/[provider]` — unlinks a
 * linked OAuth account (Google / GitHub) from the caller's user row.
 *
 * @remarks
 * Security-relevant boundary. Three orthogonal invariants asserted:
 *
 *   1. **Cross-user isolation** — scoped to `(userId, provider)`, so
 *      one user cannot unlink another's accounts. 404 on absent row
 *      (NOT 403) preserves no-existence-oracle across `/api/user/*`.
 *
 *   2. **Last-login-method guard** — the route counts remaining login
 *      methods (other OAuth accounts + passkeys + `emailVerified`-
 *      gated OTP) and returns 409 if the unlink would leave the caller
 *      with zero ways to sign in.
 *
 *   3. **Concurrency safety** — the guard runs inside a `Serializable`
 *      transaction so two simultaneous "unlink my last two accounts"
 *      requests can't both sneak past a stale "remaining=1" read.
 *      The concurrency test below asserts the invariant holds under a
 *      deliberate `Promise.all` race.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as accountRoute from "@/app/api/user/accounts/[provider]/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createAccount, createAuthenticator, createUser } from "../helpers/factories";
import { invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("DELETE /api/user/accounts/[provider]", () => {
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

  it("unlinks the named provider, leaves other providers intact", async () => {
    const alice = await createUser();
    await createAccount({ user: alice, provider: "google" });
    await createAccount({ user: alice, provider: "github" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRouteWithParams(accountRoute.DELETE, {
      method: "DELETE",
      params: { provider: "google" },
    });

    expect(status).toBe(204);

    const remaining = await prisma.account.findMany({
      where: { userId: alice.id },
      select: { provider: true },
    });
    expect(remaining).toEqual([{ provider: "github" }]);
  });

  it("⭐ isolates across users — Alice unlinking 'google' does not affect Bob's 'google'", async () => {
    const alice = await createUser();
    const bob = await createUser();
    // Grant Alice email-OTP fallback so the last-login-method guard
    // doesn't fire — this case is about cross-user isolation, not the
    // method-count check.
    await prisma.user.update({ where: { id: alice.id }, data: { emailVerified: new Date() } });
    await createAccount({ user: alice, provider: "google" });
    await createAccount({ user: bob, provider: "google" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRouteWithParams(accountRoute.DELETE, {
      method: "DELETE",
      params: { provider: "google" },
    });

    expect(status).toBe(204);

    const aliceRows = await prisma.account.count({ where: { userId: alice.id } });
    const bobRows = await prisma.account.count({ where: { userId: bob.id } });
    expect(aliceRows).toBe(0);
    expect(bobRows).toBe(1);
  });

  it("returns 404 when the caller has no account for the named provider", async () => {
    const alice = await createUser();
    await createAccount({ user: alice, provider: "github" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRouteWithParams(accountRoute.DELETE, {
      method: "DELETE",
      params: { provider: "google" },
    });

    expect(status).toBe(404);
  });

  it("returns 404 for a nonexistent provider name (no existence oracle)", async () => {
    const alice = await createUser();
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRouteWithParams(accountRoute.DELETE, {
      method: "DELETE",
      params: { provider: "definitely-not-a-real-provider" },
    });

    expect(status).toBe(404);
  });

  it("⭐ returns 409 when unlinking would leave the caller with zero login methods", async () => {
    const alice = await createUser(); // emailVerified defaults to null — no OTP fallback
    await createAccount({ user: alice, provider: "google" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRouteWithParams(accountRoute.DELETE, {
      method: "DELETE",
      params: { provider: "google" },
    });

    expect(status).toBe(409);

    const stillThere = await prisma.account.count({ where: { userId: alice.id } });
    expect(stillThere).toBe(1);
  });

  it("allows unlinking the last OAuth when emailVerified gives an OTP fallback", async () => {
    const alice = await createUser();
    await prisma.user.update({ where: { id: alice.id }, data: { emailVerified: new Date() } });
    await createAccount({ user: alice, provider: "google" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRouteWithParams(accountRoute.DELETE, {
      method: "DELETE",
      params: { provider: "google" },
    });

    expect(status).toBe(204);
    const rows = await prisma.account.count({ where: { userId: alice.id } });
    expect(rows).toBe(0);
  });

  it("allows unlinking the last OAuth when a passkey provides the fallback", async () => {
    const alice = await createUser();
    await createAccount({ user: alice, provider: "google" });
    await createAuthenticator({ user: alice });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRouteWithParams(accountRoute.DELETE, {
      method: "DELETE",
      params: { provider: "google" },
    });

    expect(status).toBe(204);
  });

  it("⭐ concurrency — Serializable isolation prevents a double-unlink race", async () => {
    // Scenario: Alice has exactly TWO accounts and no other login
    // method. The guard's contract is: at most ONE of them can be
    // unlinked. A naive read-committed implementation would let both
    // transactions see `remaining=1` and both succeed, dropping Alice
    // to zero methods — exactly the regression the `Serializable`
    // isolation level is there to catch.
    const alice = await createUser();
    await createAccount({ user: alice, provider: "google" });
    await createAccount({ user: alice, provider: "github" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    // Fire both deletes concurrently.
    const results = await Promise.all([
      invokeRouteWithParams(accountRoute.DELETE, {
        method: "DELETE",
        params: { provider: "google" },
      }).catch((err) => ({ status: 500, error: err as unknown })),
      invokeRouteWithParams(accountRoute.DELETE, {
        method: "DELETE",
        params: { provider: "github" },
      }).catch((err) => ({ status: 500, error: err as unknown })),
    ]);

    // The KEY invariant — Alice always retains at least one account.
    // Individual outcome shapes ("both 204", "one 204 + one 409", "one
    // 204 + one 500 from serialization failure") are all acceptable
    // AS LONG AS the final row count is ≥ 1. We don't assert
    // exact-one-succeeds because Postgres may resolve the conflict by
    // failing either side; what matters is the USER isn't locked out.
    const remaining = await prisma.account.count({ where: { userId: alice.id } });
    expect(remaining).toBeGreaterThanOrEqual(1);

    // Belt-and-braces: at least one of the two responses must be a
    // non-2xx (otherwise we'd have dropped to 0 accounts, contradicting
    // the count assertion above — but fail fast with a clearer message).
    const successes = results.filter((r) => r.status >= 200 && r.status < 300);
    expect(successes.length).toBeLessThanOrEqual(1);
  });
});
