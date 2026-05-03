/**
 * Plumbing-only — Testcontainers → `db push` → worker clone → PrismaClient →
 * factories → roundtrip. Exists for diagnostic narrowing: when the suite goes
 * red, smoke answers "plumbing or my code?" in ~2 seconds. Red smoke = setup/
 * or helpers/ regression; green smoke + downstream red = route/factory bug.
 *
 * Do NOT add business-logic tests here — they belong in behaviour-scoped files.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import { getTestPrisma, truncateAll } from "../helpers/db";
import { createOrganization, createUser } from "../helpers/factories";

describe("infrastructure smoke", () => {
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

  it("creates a user via factory and reads it back", async () => {
    const user = await createUser({ email: "smoke@test.local", locale: "uk" });
    const found = await prisma.user.findUnique({ where: { id: user.id } });

    expect(found).not.toBeNull();
    expect(found?.email).toBe("smoke@test.local");
    expect(found?.locale).toBe("uk");
  });

  it("creates an organisation with an owner membership wired up", async () => {
    const owner = await createUser();
    const org = await createOrganization({ owner, name: "Smoke Org" });

    const memberships = await prisma.membership.findMany({
      where: { organizationId: org.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe("OWNER");
    expect(memberships[0]?.userId).toBe(owner.id);
  });

  it("truncates user-owned tables between tests for isolation", async () => {
    // No orgs should leak from the previous test if `beforeEach` TRUNCATE ran.
    const count = await prisma.organization.count();
    expect(count).toBe(0);
  });
});
