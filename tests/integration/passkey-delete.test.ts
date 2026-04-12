/**
 * Integration tests for `/api/user/passkeys/[credentialId]` — passkey rename + delete.
 *
 * @remarks
 * Security-sensitive surface. The `(credentialID, userId)` scoping is
 * the single guard against a cross-user privilege escalation: if a
 * credentialID were leaked (XSS, log spill, screenshot), the scoping
 * ensures another user still can't DELETE or rename someone else's
 * passkey.
 *
 * Both operations return `404 Passkey not found` (NOT 403) when the
 * target credentialID doesn't belong to the caller — deliberate
 * choice, matches the no-existence-oracle pattern used across the
 * API: an attacker probing credentialIDs gets the same response for
 * "doesn't exist anywhere" and "exists but belongs to someone else",
 * so the response can't be used to enumerate valid IDs.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as passkeyRoute from "@/app/api/user/passkeys/[credentialId]/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createAuthenticator, createUser } from "../helpers/factories";
import { invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("/api/user/passkeys/[credentialId]", () => {
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

  describe("DELETE", () => {
    it("deletes the caller's own passkey (204, row gone)", async () => {
      const alice = await createUser();
      const passkey = await createAuthenticator({ user: alice, name: "MacBook Touch ID" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(passkeyRoute.DELETE, {
        method: "DELETE",
        params: { credentialId: passkey.credentialID },
      });

      expect(status).toBe(204);
      const gone = await prisma.authenticator.findUnique({
        where: { credentialID: passkey.credentialID },
      });
      expect(gone).toBeNull();
    });

    it("⭐ returns 404 when deleting a credentialID that belongs to another user", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const bobPasskey = await createAuthenticator({ user: bob });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(passkeyRoute.DELETE, {
        method: "DELETE",
        params: { credentialId: bobPasskey.credentialID },
      });

      // 404 not 403 — no existence oracle on credentialIDs.
      expect(status).toBe(404);

      const stillThere = await prisma.authenticator.findUnique({
        where: { credentialID: bobPasskey.credentialID },
      });
      expect(stillThere).not.toBeNull();
    });

    it("returns 404 for a non-existent credentialID", async () => {
      const alice = await createUser();
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(passkeyRoute.DELETE, {
        method: "DELETE",
        params: { credentialId: "cred_does_not_exist" },
      });
      expect(status).toBe(404);
    });
  });

  describe("PATCH (rename)", () => {
    it("renames the caller's own passkey", async () => {
      const alice = await createUser();
      const passkey = await createAuthenticator({ user: alice, name: "Old Name" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(passkeyRoute.PATCH, {
        method: "PATCH",
        body: { name: "iPhone Face ID" },
        params: { credentialId: passkey.credentialID },
      });

      expect(status).toBe(204);
      const row = await prisma.authenticator.findUnique({
        where: { credentialID: passkey.credentialID },
      });
      expect(row?.name).toBe("iPhone Face ID");
    });

    it("returns 404 when renaming another user's passkey", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const bobPasskey = await createAuthenticator({ user: bob, name: "Bob's Key" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(passkeyRoute.PATCH, {
        method: "PATCH",
        body: { name: "Pwned" },
        params: { credentialId: bobPasskey.credentialID },
      });

      expect(status).toBe(404);

      const row = await prisma.authenticator.findUnique({
        where: { credentialID: bobPasskey.credentialID },
      });
      expect(row?.name).toBe("Bob's Key");
    });

    it("returns 400 for an empty name (zod rejection)", async () => {
      const alice = await createUser();
      const passkey = await createAuthenticator({ user: alice });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(passkeyRoute.PATCH, {
        method: "PATCH",
        body: { name: "" },
        params: { credentialId: passkey.credentialID },
      });
      expect(status).toBe(400);
    });
  });
});
