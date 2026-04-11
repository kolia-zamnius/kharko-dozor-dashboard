/**
 * Unit tests for `requireMember` + `requireProjectMember`.
 *
 * @remarks
 * The RBAC source of truth. These two helpers throw `HttpError` with
 * exact status codes (403 / 404) that the API-boundary HOFs turn into
 * client responses. A regression here silently flips an allow into a
 * deny (or, worse, the other direction) without any other test on the
 * route catching it — most integration tests only assert the success
 * path. Prisma is module-mocked so the tests are pure unit + fast.
 *
 * Integration tests in Wave 3 exercise the DB-backed path end-to-end;
 * this suite is the fine-grained logic layer.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/client", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/server/db/client";
import { isHttpError } from "@/server/http-error";
import type { UserId } from "@/types/ids";

import { requireMember, requireProjectMember } from "./permissions";

const mockedMembershipFind = vi.mocked(prisma.membership.findUnique);
const mockedProjectFind = vi.mocked(prisma.project.findUnique);

const USER_ID = "user_1" as UserId;
const ORG_ID = "org_1";
const PROJECT_ID = "proj_1";

function membershipRow(role: "OWNER" | "ADMIN" | "VIEWER") {
  return {
    id: "mem_1",
    userId: USER_ID,
    organizationId: ORG_ID,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Awaited<ReturnType<typeof prisma.membership.findUnique>>;
}

describe("requireMember", () => {
  beforeEach(() => {
    mockedMembershipFind.mockReset();
  });

  it("throws HttpError(403, 'Not a member') when no row is found", async () => {
    mockedMembershipFind.mockResolvedValue(null);

    await expect(requireMember(USER_ID, ORG_ID)).rejects.toSatisfy((err) => {
      if (!isHttpError(err)) return false;
      expect(err.status).toBe(403);
      expect(err.message).toBe("Not a member");
      return true;
    });
  });

  it("throws HttpError(403, 'Insufficient permissions') when the role is below minRole", async () => {
    mockedMembershipFind.mockResolvedValue(membershipRow("VIEWER"));

    await expect(requireMember(USER_ID, ORG_ID, "OWNER")).rejects.toSatisfy((err) => {
      if (!isHttpError(err)) return false;
      expect(err.status).toBe(403);
      expect(err.message).toBe("Insufficient permissions");
      return true;
    });
  });

  it("returns the membership row when the role meets minRole exactly", async () => {
    mockedMembershipFind.mockResolvedValue(membershipRow("ADMIN"));
    const row = await requireMember(USER_ID, ORG_ID, "ADMIN");
    expect(row.role).toBe("ADMIN");
  });

  it("returns the membership row when the role is above minRole (OWNER ≥ VIEWER)", async () => {
    mockedMembershipFind.mockResolvedValue(membershipRow("OWNER"));
    const row = await requireMember(USER_ID, ORG_ID, "VIEWER");
    expect(row.role).toBe("OWNER");
  });

  it("defaults minRole to VIEWER (any member passes)", async () => {
    mockedMembershipFind.mockResolvedValue(membershipRow("VIEWER"));
    const row = await requireMember(USER_ID, ORG_ID);
    expect(row.role).toBe("VIEWER");
  });

  // Capability matrix — every role × minRole combination. Exercises the
  // rank-based "at least this role" comparison directly.
  it.each<["OWNER" | "ADMIN" | "VIEWER", "OWNER" | "ADMIN" | "VIEWER", boolean]>([
    // [userRole, requiredRole, shouldPass]
    ["VIEWER", "VIEWER", true],
    ["VIEWER", "ADMIN", false],
    ["VIEWER", "OWNER", false],
    ["ADMIN", "VIEWER", true],
    ["ADMIN", "ADMIN", true],
    ["ADMIN", "OWNER", false],
    ["OWNER", "VIEWER", true],
    ["OWNER", "ADMIN", true],
    ["OWNER", "OWNER", true],
  ])("%s member requesting minRole=%s → shouldPass=%s", async (userRole, requiredRole, shouldPass) => {
    mockedMembershipFind.mockResolvedValue(membershipRow(userRole));
    if (shouldPass) {
      const row = await requireMember(USER_ID, ORG_ID, requiredRole);
      expect(row.role).toBe(userRole);
    } else {
      await expect(requireMember(USER_ID, ORG_ID, requiredRole)).rejects.toSatisfy(
        (err) => isHttpError(err) && err.status === 403,
      );
    }
  });
});

describe("requireProjectMember", () => {
  beforeEach(() => {
    mockedMembershipFind.mockReset();
    mockedProjectFind.mockReset();
  });

  it("throws HttpError(404, 'Project not found') when the project doesn't exist", async () => {
    mockedProjectFind.mockResolvedValue(null);

    await expect(requireProjectMember(USER_ID, PROJECT_ID)).rejects.toSatisfy((err) => {
      if (!isHttpError(err)) return false;
      expect(err.status).toBe(404);
      expect(err.message).toBe("Project not found");
      return true;
    });
    // Doesn't even attempt the membership lookup — short-circuits on 404.
    expect(mockedMembershipFind).not.toHaveBeenCalled();
  });

  it("throws HttpError(403, 'Not a member') when the project exists but the user isn't in its org", async () => {
    mockedProjectFind.mockResolvedValue({ id: PROJECT_ID, organizationId: ORG_ID } as Awaited<
      ReturnType<typeof prisma.project.findUnique>
    >);
    mockedMembershipFind.mockResolvedValue(null);

    await expect(requireProjectMember(USER_ID, PROJECT_ID)).rejects.toSatisfy((err) => {
      if (!isHttpError(err)) return false;
      expect(err.status).toBe(403);
      return true;
    });
  });

  it("returns { project, membership } when both lookups succeed with sufficient role", async () => {
    mockedProjectFind.mockResolvedValue({ id: PROJECT_ID, organizationId: ORG_ID } as Awaited<
      ReturnType<typeof prisma.project.findUnique>
    >);
    mockedMembershipFind.mockResolvedValue(membershipRow("OWNER"));

    const result = await requireProjectMember(USER_ID, PROJECT_ID, "ADMIN");
    expect(result.project.id).toBe(PROJECT_ID);
    expect(result.membership.role).toBe("OWNER");
  });

  it("escalates the role requirement through the underlying requireMember", async () => {
    mockedProjectFind.mockResolvedValue({ id: PROJECT_ID, organizationId: ORG_ID } as Awaited<
      ReturnType<typeof prisma.project.findUnique>
    >);
    mockedMembershipFind.mockResolvedValue(membershipRow("ADMIN"));

    await expect(requireProjectMember(USER_ID, PROJECT_ID, "OWNER")).rejects.toSatisfy(
      (err) => isHttpError(err) && err.status === 403,
    );
  });
});
