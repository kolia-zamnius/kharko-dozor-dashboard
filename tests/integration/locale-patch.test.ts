/**
 * Integration tests for `PATCH /api/user/locale`.
 *
 * @remarks
 * Small route with a large blast radius — every authenticated user hits
 * it once per locale change, and an invalid write would desync
 * `User.locale` from the JWT callback's `hasLocale` narrow, eventually
 * causing a `MODULE_NOT_FOUND` at `import("./messages/{locale}/…")`.
 * The zod enum derived from `LOCALES` is the guard; these tests prove
 * it fires at the boundary.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import * as localeRoute from "@/app/api/user/locale/route";

import { LOCALES } from "@/i18n/config";
import { buildSession, buildSessionUser } from "../helpers/auth-mock";
import { getTestPrisma, truncateAll } from "../helpers/db";
import { createUser } from "../helpers/factories";
import { invokeRoute } from "../helpers/invoke-route";
import { mockAuth } from "../helpers/mocks";

describe("PATCH /api/user/locale", () => {
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

  it.each(LOCALES)("persists %s as the user's new locale", async (locale) => {
    const alice = await createUser({ locale: "en" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status } = await invokeRoute(localeRoute.PATCH, {
      method: "PATCH",
      body: { locale },
    });

    expect(status).toBe(204);
    const refreshed = await prisma.user.findUnique({ where: { id: alice.id } });
    expect(refreshed?.locale).toBe(locale);
  });

  it("rejects an unknown locale with 400 + issues", async () => {
    const alice = await createUser({ locale: "en" });
    mockAuth.mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));

    const { status, json } = await invokeRoute<{ error: string; issues: unknown[] }>(localeRoute.PATCH, {
      method: "PATCH",
      body: { locale: "kz" },
    });

    expect(status).toBe(400);
    expect(json.issues.length).toBeGreaterThan(0);

    // DB unchanged — guard fires BEFORE any write.
    const refreshed = await prisma.user.findUnique({ where: { id: alice.id } });
    expect(refreshed?.locale).toBe("en");
  });
});
