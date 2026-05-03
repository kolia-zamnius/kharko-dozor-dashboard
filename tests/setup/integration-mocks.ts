/**
 * Auto-mocks scoped to the integration project (vitest.config.ts `integrationSetupFiles`).
 * Unit and contract projects skip this file, so a misplaced "unit" test that hits
 * `@/server/auth` or Prisma fails loudly instead of silently using a stub.
 *
 * `next-intl/server::getTranslations` returns an echo translator — assertions match
 * key shapes without needing locale JSON parity in fixtures.
 */

import type { getTranslations } from "next-intl/server";
import { beforeEach, vi } from "vitest";

import { mockAuth } from "../helpers/mocks";

vi.mock("@/server/auth", () => ({ auth: mockAuth }));

vi.mock("@/server/db/client", async () => {
  const { getTestPrisma } = await import("../helpers/db");
  return { prisma: await getTestPrisma() };
});

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const t = (key: string) => key;
    return t as unknown as Awaited<ReturnType<typeof getTranslations>>;
  }),
}));

beforeEach(() => {
  mockAuth.mockReset();
});
