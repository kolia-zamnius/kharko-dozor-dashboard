/**
 * ⭐ Flagship integration suite — RBAC permission matrix.
 *
 * @remarks
 * Every protected route is exercised against every `Role` with both a
 * "should allow" and "should deny" assertion. The matrix is driven by a
 * `describe.each` table so adding a new action is a one-row edit, and
 * the capability matrix in `src/server/auth/permissions.ts` stays
 * uncontested single-source-of-truth: a drift between the documented
 * matrix and actual route behaviour fails a specific row here with the
 * exact role × action that regressed.
 *
 * Per-file mocks below **override** the shared stubs from
 * `tests/setup/integration-mocks.ts`:
 *   - `next-intl/server` needs `t.markup` support (invite route uses it).
 *   - `@/server/mailer` stubbed so send-invite scenarios don't try SMTP.
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
import * as projectsRoute from "@/app/api/projects/route";
import * as projectDetailRoute from "@/app/api/projects/[projectId]/route";
import * as projectKeyRoute from "@/app/api/projects/[projectId]/key/route";
import * as projectRegenRoute from "@/app/api/projects/[projectId]/regenerate-key/route";

import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createMembership, createOrganization, createProject, createUser } from "../helpers/factories";
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
  | "regenerate-project-key";

/**
 * Capability matrix — authoritative expected behaviour per role × action.
 * Mirrors the `src/server/auth/permissions.ts` JSDoc verbatim; a diff
 * between the two surfaces in this test file first.
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

  /**
   * Per-action scenario — seeds an org + project + one actor with the
   * given role, then invokes the route. Returns `response.status` so the
   * assertion reads as `status === 403 ? denied : allowed`.
   */
  async function runScenario(action: ActionName, actorRole: Role): Promise<number> {
    // Always have a separate OWNER so deleting/demoting one actor doesn't
    // leave an ownerless org (would short-circuit on schema invariants).
    const founder = await createUser();
    const actor = await createUser();
    const team = await createOrganization({ owner: founder, type: "TEAM" });
    await createMembership({ user: actor, organization: team, role: actorRole });
    const project = await createProject({ organization: team });

    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: actor.id })));

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
    }
  }

  // Generate a row per (action, role) combination — 8 actions × 3 roles
  // = 24 assertions. Each test runs in full isolation (truncate between).
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
