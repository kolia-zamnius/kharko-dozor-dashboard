/**
 * `DELETE /api/user/accounts/[provider]`. Three invariants:
 *
 *   1. Cross-user isolation — scoped to `(userId, provider)`. 404 (not 403)
 *      on absent row preserves no-existence-oracle across `/api/user/*`.
 *   2. Last-login-method guard — counts remaining methods (OAuth + passkeys
 *      + `emailVerified`-gated OTP) and returns 409 if unlink would zero out.
 *   3. Concurrency — guard runs inside a `Serializable` transaction so two
 *      simultaneous "unlink my last two" requests can't both pass a stale
 *      `remaining=1` read.
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
    // OTP fallback so the last-login-method guard doesn't fire — this case is about isolation, not method count.
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
    // Alice has exactly two accounts, no other method. Naive read-committed
    // would let both txns see `remaining=1` and both succeed, dropping her to
    // zero — exactly the regression `Serializable` is there to catch.
    const alice = await createUser();
    await createAccount({ user: alice, provider: "google" });
    await createAccount({ user: alice, provider: "github" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

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

    // The invariant: Alice retains ≥1 account. Outcome shapes (204/204, 204/409,
    // 204/500-on-serialization-failure) all valid — Postgres may fail either
    // side. What matters is the user isn't locked out.
    const remaining = await prisma.account.count({ where: { userId: alice.id } });
    expect(remaining).toBeGreaterThanOrEqual(1);

    // Belt-and-braces — at most one success. Redundant with the count above
    // but fails with a clearer message if Serializable regressed.
    const successes = results.filter((r) => r.status >= 200 && r.status < 300);
    expect(successes.length).toBeLessThanOrEqual(1);
  });
});
