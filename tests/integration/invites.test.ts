/**
 * Invite lifecycle: create/refresh, change-role/extend, revoke, user-side accept.
 * State machine: pending → refresh-in-place → extend → role change → accept
 * (membership created) | revoke (row deleted).
 *
 * Per-file `vi.mock`s override the shared stubs — `next-intl/server` needs
 * `t.markup` (invite email uses it); mailer stubbed so no SMTP fires; rate
 * limit no-op'd so multi-invite tests don't trip the daily cap.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { getTranslations } from "next-intl/server";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const t = ((key: string) => key) as unknown as Awaited<ReturnType<typeof getTranslations>>;
    // `inviteEmailHtml` calls `t.markup(...)` for HTML-in-messages.
    (t as unknown as { markup: (k: string) => string }).markup = (k: string) => k;
    return t;
  }),
}));

vi.mock("@/server/mailer", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/invite-rate-limit", () => ({
  assertInviteRateLimit: vi.fn().mockResolvedValue(undefined),
  bumpInviteRateLimit: vi.fn().mockResolvedValue(undefined),
  queryInviteRateLimit: vi.fn().mockResolvedValue({ count: 0, limit: 10, remaining: 10 }),
}));

import type { PrismaClient } from "@/generated/prisma/client";

import * as invitesRoute from "@/app/api/organizations/[orgId]/invites/route";
import * as inviteDetailRoute from "@/app/api/organizations/[orgId]/invites/[inviteId]/route";
import * as acceptRoute from "@/app/api/user/invites/[id]/accept/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createInvite, createMembership, createOrganization, createUser } from "../helpers/factories";
import { invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("invite lifecycle", () => {
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

  describe("POST /api/organizations/[orgId]/invites (create)", () => {
    it("OWNER creates a new PENDING invite", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status, json } = await invokeRouteWithParams<
        { orgId: string },
        { id: string; email: string; role: string }
      >(invitesRoute.POST, {
        method: "POST",
        body: { email: "invitee@test.local", role: "ADMIN" },
        params: { orgId: team.id },
      });

      expect(status).toBe(200);
      expect(json.email).toBe("invitee@test.local");
      expect(json.role).toBe("ADMIN");

      const stored = await prisma.invite.findUnique({ where: { id: json.id } });
      expect(stored?.status).toBe("PENDING");
    });

    it("resend refreshes an existing PENDING invite in place (idempotent)", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const existing = await createInvite({
        organization: team,
        email: "stale@test.local",
        role: "VIEWER",
        invitedBy: alice,
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status, json } = await invokeRouteWithParams<{ orgId: string }, { id: string; role: string }>(
        invitesRoute.POST,
        {
          method: "POST",
          body: { email: "stale@test.local", role: "ADMIN" },
          params: { orgId: team.id },
        },
      );

      expect(status).toBe(200);
      // Same row updated, not a new one.
      expect(json.id).toBe(existing.id);
      expect(json.role).toBe("ADMIN");

      const count = await prisma.invite.count({ where: { organizationId: team.id } });
      expect(count).toBe(1);
    });

    it("returns 409 when the email already belongs to a member", async () => {
      const alice = await createUser();
      const bob = await createUser({ email: "bob@test.local" });
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "VIEWER" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(invitesRoute.POST, {
        method: "POST",
        body: { email: "bob@test.local", role: "ADMIN" },
        params: { orgId: team.id },
      });

      expect(status).toBe(409);
    });

    it("returns 403 when called by ADMIN (OWNER-only)", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "ADMIN" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(invitesRoute.POST, {
        method: "POST",
        body: { email: "new@test.local", role: "VIEWER" },
        params: { orgId: team.id },
      });

      expect(status).toBe(403);
    });

    it("refuses to invite into Personal Space with 403", async () => {
      const alice = await createUser();
      const personal = await createOrganization({ owner: alice, type: "PERSONAL" });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(invitesRoute.POST, {
        method: "POST",
        body: { email: "new@test.local", role: "VIEWER" },
        params: { orgId: personal.id },
      });

      expect(status).toBe(403);
    });
  });

  describe("PATCH /api/organizations/[orgId]/invites/[inviteId]", () => {
    it("change-role action updates role in place", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const invite = await createInvite({
        organization: team,
        email: "x@test.local",
        role: "VIEWER",
        invitedBy: alice,
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(inviteDetailRoute.PATCH, {
        method: "PATCH",
        body: { action: "change-role", role: "ADMIN" },
        params: { orgId: team.id, inviteId: invite.id },
      });

      expect(status).toBe(204);
      const updated = await prisma.invite.findUnique({ where: { id: invite.id } });
      expect(updated?.role).toBe("ADMIN");
    });

    it("extend action resets expiresAt and re-attributes invitedBy to caller", async () => {
      const alice = await createUser();
      const bob = await createUser();
      const team = await createOrganization({ owner: alice });
      await createMembership({ user: bob, organization: team, role: "OWNER" });
      const invite = await createInvite({
        organization: team,
        email: "x@test.local",
        invitedBy: alice,
        expiresAt: new Date(Date.now() + 60_000), // near-expiry
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id })));

      const { status } = await invokeRouteWithParams(inviteDetailRoute.PATCH, {
        method: "PATCH",
        body: { action: "extend" },
        params: { orgId: team.id, inviteId: invite.id },
      });

      expect(status).toBe(204);
      const updated = await prisma.invite.findUnique({ where: { id: invite.id } });
      // Pushed well into the future + attributed to Bob.
      expect(updated!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 24 * 60 * 60 * 1000);
      expect(updated?.invitedById).toBe(bob.id);
    });
  });

  describe("DELETE /api/organizations/[orgId]/invites/[inviteId] (revoke)", () => {
    it("hard-deletes the pending invite row", async () => {
      const alice = await createUser();
      const team = await createOrganization({ owner: alice });
      const invite = await createInvite({
        organization: team,
        email: "x@test.local",
        invitedBy: alice,
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

      const { status } = await invokeRouteWithParams(inviteDetailRoute.DELETE, {
        method: "DELETE",
        params: { orgId: team.id, inviteId: invite.id },
      });

      expect(status).toBe(204);
      expect(await prisma.invite.findUnique({ where: { id: invite.id } })).toBeNull();
    });
  });

  describe("POST /api/user/invites/[id]/accept", () => {
    it("creates a Membership and flips the invite to ACCEPTED atomically", async () => {
      const alice = await createUser();
      const bob = await createUser({ email: "bob@test.local" });
      const team = await createOrganization({ owner: alice });
      const invite = await createInvite({
        organization: team,
        email: "bob@test.local",
        role: "ADMIN",
        invitedBy: alice,
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id, email: "bob@test.local" })));

      const { status } = await invokeRouteWithParams(acceptRoute.POST, {
        method: "POST",
        params: { id: invite.id },
      });

      expect(status).toBe(200);
      const membership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId: bob.id, organizationId: team.id } },
      });
      expect(membership?.role).toBe("ADMIN");

      const finalInvite = await prisma.invite.findUnique({ where: { id: invite.id } });
      expect(finalInvite?.status).toBe("ACCEPTED");
    });

    it("⭐ concurrency — Serializable isolation rejects double-accept race with 409", async () => {
      // Bob double-clicks Accept (or two tabs). Naive: both txns see PENDING,
      // second commit hits `(userId, organizationId)` unique → 500. With the
      // fix one wins (200), the other gets 409 via P2002/P2034 collapse.
      const alice = await createUser();
      const bob = await createUser({ email: "bob@test.local" });
      const team = await createOrganization({ owner: alice });
      const invite = await createInvite({
        organization: team,
        email: "bob@test.local",
        role: "ADMIN",
        invitedBy: alice,
      });
      mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: bob.id, email: "bob@test.local" })));

      const results = await Promise.all([
        invokeRouteWithParams(acceptRoute.POST, {
          method: "POST",
          params: { id: invite.id },
        }).catch((err) => ({ status: 500, error: err as unknown })),
        invokeRouteWithParams(acceptRoute.POST, {
          method: "POST",
          params: { id: invite.id },
        }).catch((err) => ({ status: 500, error: err as unknown })),
      ]);

      // Invariant — exactly one membership; doubles = unique constraint missed the race.
      const memberships = await prisma.membership.findMany({
        where: { userId: bob.id, organizationId: team.id },
      });
      expect(memberships).toHaveLength(1);
      expect(memberships[0]?.role).toBe("ADMIN");

      const finalInvite = await prisma.invite.findUnique({ where: { id: invite.id } });
      expect(finalInvite?.status).toBe("ACCEPTED");

      // Exactly one 2xx winner — the other lands at 409 or a 4xx from the
      // assertInviteUsableForUser pre-check (already ACCEPTED). No 500s.
      const successes = results.filter((r) => r.status >= 200 && r.status < 300);
      expect(successes).toHaveLength(1);
      expect(results.some((r) => r.status >= 500)).toBe(false);
    });
  });
});
