/**
 * RBAC drift detector — every protected route × every `Role` × {allow, deny}.
 * Driven by `describe.each` so adding an action is a one-row edit. Drift
 * between the documented matrix in `src/server/auth/permissions.ts` and
 * actual route behaviour fails the specific role × action that regressed.
 *
 * Per-file `vi.mock`s below override the shared stubs — `next-intl/server`
 * needs `t.markup` (invite emails use it); `@/server/mailer` stubbed to skip
 * SMTP.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { getTranslations } from "next-intl/server";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const t = ((key: string) => key) as unknown as Awaited<ReturnType<typeof getTranslations>>;
    (t as unknown as { markup: (k: string) => string }).markup = (k) => k;
    return t;
  }),
}));

vi.mock("@/server/mailer", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

import type { PrismaClient, Role } from "@/generated/prisma/client";

import * as orgDetailRoute from "@/app/api/organizations/[orgId]/route";
import * as invitesRoute from "@/app/api/organizations/[orgId]/invites/route";
import * as memberDetailRoute from "@/app/api/organizations/[orgId]/members/[memberId]/route";
import * as projectsRoute from "@/app/api/projects/route";
import * as projectDetailRoute from "@/app/api/projects/[projectId]/route";
import * as projectKeyRoute from "@/app/api/projects/[projectId]/key/route";
import * as projectRegenRoute from "@/app/api/projects/[projectId]/regenerate-key/route";
import * as sessionDetailRoute from "@/app/api/sessions/[sessionId]/route";
import * as trackedUserDisplayNameRoute from "@/app/api/tracked-users/[userId]/display-name/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import {
  createMembership,
  createOrganization,
  createProject,
  createSession,
  createTrackedUser,
  createUser,
} from "../helpers/factories";
import { invokeRoute, invokeRouteWithParams } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

type ActionName =
  | "rename-org"
  | "delete-org"
  | "send-invite"
  | "create-project"
  | "rename-project"
  | "delete-project"
  | "get-project-key"
  | "regenerate-project-key"
  | "remove-member"
  | "change-member-role"
  | "session-delete"
  | "tracked-user-display-name-update";

/**
 * Mirrors `src/server/auth/permissions.ts` verbatim — drift surfaces here.
 * User-scoped actions (`active-org-switch`, `passkey-delete`,
 * `account-unlink`) aren't role-gated, so they live in dedicated tests.
 */
const MATRIX: Record<ActionName, Record<Role, boolean>> = {
  "rename-org": { OWNER: true, ADMIN: true, VIEWER: false },
  "delete-org": { OWNER: true, ADMIN: false, VIEWER: false },
  "send-invite": { OWNER: true, ADMIN: false, VIEWER: false },
  "create-project": { OWNER: true, ADMIN: false, VIEWER: false },
  "rename-project": { OWNER: true, ADMIN: true, VIEWER: false },
  "delete-project": { OWNER: true, ADMIN: false, VIEWER: false },
  "get-project-key": { OWNER: true, ADMIN: false, VIEWER: false },
  "regenerate-project-key": { OWNER: true, ADMIN: false, VIEWER: false },
  // Removing/demoting OTHER members — OWNER only. Self-leave is a separate flow.
  "remove-member": { OWNER: true, ADMIN: false, VIEWER: false },
  "change-member-role": { OWNER: true, ADMIN: false, VIEWER: false },
  // ADMIN-tier — operational metadata edits.
  "session-delete": { OWNER: true, ADMIN: true, VIEWER: false },
  "tracked-user-display-name-update": { OWNER: true, ADMIN: true, VIEWER: false },
};

const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "VIEWER"];
const ALL_ACTIONS = Object.keys(MATRIX) as ActionName[];

describe("RBAC permission matrix", () => {
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

  async function runScenario(action: ActionName, actorRole: Role): Promise<number> {
    // Separate OWNER so deleting/demoting the actor doesn't leave the org ownerless.
    const founder = await createUser();
    const actor = await createUser();
    const team = await createOrganization({ owner: founder, type: "TEAM" });
    await createMembership({ user: actor, organization: team, role: actorRole });
    const project = await createProject({ organization: team });

    // Pin `activeOrganizationId` so resource-access routes pass the cross-org
    // check — this grid is about RBAC alone; leak coverage is in cross-org-access.
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: actor.id, activeOrganizationId: team.id })));

    switch (action) {
      case "rename-org": {
        const { status } = await invokeRouteWithParams(orgDetailRoute.PATCH, {
          method: "PATCH",
          body: { name: "Renamed" },
          params: { orgId: team.id },
        });
        return status;
      }
      case "delete-org": {
        const { status } = await invokeRouteWithParams(orgDetailRoute.DELETE, {
          method: "DELETE",
          params: { orgId: team.id },
        });
        return status;
      }
      case "send-invite": {
        const { status } = await invokeRouteWithParams(invitesRoute.POST, {
          method: "POST",
          body: { email: `recipient-${Date.now()}@test.local`, role: "VIEWER" },
          params: { orgId: team.id },
        });
        return status;
      }
      case "create-project": {
        const { status } = await invokeRoute(projectsRoute.POST, {
          method: "POST",
          body: { name: "New Project", organizationId: team.id },
        });
        return status;
      }
      case "rename-project": {
        const { status } = await invokeRouteWithParams(projectDetailRoute.PATCH, {
          method: "PATCH",
          body: { name: "Renamed" },
          params: { projectId: project.id },
        });
        return status;
      }
      case "delete-project": {
        const { status } = await invokeRouteWithParams(projectDetailRoute.DELETE, {
          method: "DELETE",
          params: { projectId: project.id },
        });
        return status;
      }
      case "get-project-key": {
        const { status } = await invokeRouteWithParams(projectKeyRoute.GET, {
          method: "GET",
          params: { projectId: project.id },
        });
        return status;
      }
      case "regenerate-project-key": {
        const { status } = await invokeRouteWithParams(projectRegenRoute.POST, {
          method: "POST",
          params: { projectId: project.id },
        });
        return status;
      }
      case "remove-member": {
        // Distinct VIEWER target — removing someone other than self triggers
        // the OWNER-only branch (self-leave is a separate flow).
        const targetUser = await createUser();
        const target = await createMembership({ user: targetUser, organization: team, role: "VIEWER" });
        const { status } = await invokeRouteWithParams(memberDetailRoute.DELETE, {
          method: "DELETE",
          params: { orgId: team.id, memberId: target.id },
        });
        return status;
      }
      case "change-member-role": {
        const targetUser = await createUser();
        const target = await createMembership({ user: targetUser, organization: team, role: "VIEWER" });
        const { status } = await invokeRouteWithParams(memberDetailRoute.PATCH, {
          method: "PATCH",
          body: { role: "ADMIN" },
          params: { orgId: team.id, memberId: target.id },
        });
        return status;
      }
      case "session-delete": {
        const session = await createSession({ project });
        const { status } = await invokeRouteWithParams(sessionDetailRoute.DELETE, {
          method: "DELETE",
          params: { sessionId: session.id },
        });
        return status;
      }
      case "tracked-user-display-name-update": {
        const trackedUser = await createTrackedUser({ project });
        const { status } = await invokeRouteWithParams(trackedUserDisplayNameRoute.PATCH, {
          method: "PATCH",
          body: { customName: "Renamed" },
          params: { userId: trackedUser.id },
        });
        return status;
      }
    }
  }

  // 12 actions × 3 roles = 36 rows, isolated by truncate-between.
  describe.each(ALL_ACTIONS)("%s", (action) => {
    it.each(ALL_ROLES)(`role=%s`, async (role) => {
      const allowed = MATRIX[action][role];
      const status = await runScenario(action, role);

      if (allowed) {
        expect(status, `${action} as ${role} should succeed`).toBeLessThan(300);
        expect(status).toBeGreaterThanOrEqual(200);
      } else {
        expect(status, `${action} as ${role} should be denied`).toBe(403);
      }
    });
  });
});
