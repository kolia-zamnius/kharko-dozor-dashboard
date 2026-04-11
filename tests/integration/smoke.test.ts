/**
 * Integration smoke test — plumbing-only assertions that the full test-
 * infrastructure pipeline is healthy:
 *
 *   Testcontainers Postgres → `prisma db push` → worker DB clone →
 *   PrismaClient via `@prisma/adapter-pg` → factory inserts → row reads back.
 *
 * @remarks
 * One might ask: why keep this file at all, since every OTHER integration
 * test implicitly relies on the same pipeline — if Testcontainers breaks,
 * everything fails, not just smoke? The answer is **diagnostic narrowing**.
 * When `npm run test:integration` returns a wall of red, the on-call
 * reviewer's first question is: "plumbing or my code?" `smoke.test.ts`
 * answers it in ~2 seconds — a red smoke = `tests/setup/global-setup.ts`
 * or `tests/helpers/db.ts` regression; a green smoke with downstream red
 * = route / factory regression. Without this file that diagnostic
 * question takes minutes of `docker logs` spelunking instead.
 *
 * Deliberately minimal — three tests, no mocks beyond the shared setup
 * file. Do NOT add business-logic tests here; they belong in a
 * behaviour-scoped file like `organizations.test.ts` or `invites.test.ts`.
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
    // If the `beforeEach` TRUNCATE ran, no orgs should have leaked from
    // the previous test in this file.
    const count = await prisma.organization.count();
    expect(count).toBe(0);
  });
});
