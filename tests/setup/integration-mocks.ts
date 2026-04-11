/**
 * Integration-project setup file — installs the three `vi.mock` calls
 * that every integration test used to copy-paste at the top of itself.
 *
 * @remarks
 * Runs AFTER `load-env.ts` + `vitest.setup.ts` (per `vitest.config.ts`
 * `setupFiles` order) and ONLY for the integration project. Unit and
 * contract projects never load this file, so their SUTs touch the real
 * `@/server/auth`, the real `@/server/db/client`, and the real
 * `next-intl/server` — if a file that claims to be a unit test quietly
 * hits one of them, it fails loudly instead of silently using a stub.
 *
 * Wiring shape:
 *
 *   - `@/server/auth` → returns the stateful `mockAuth` handle from
 *     `tests/helpers/mocks.ts`. Tests import `mockAuth` and call
 *     `.mockResolvedValue(session)` per-case.
 *   - `@/server/db/client` → real Prisma client pointed at the
 *     per-worker test DB (see `tests/helpers/db.ts`).
 *   - `next-intl/server::getTranslations` → echo translator that
 *     returns keys verbatim so assertions match key shapes without
 *     maintaining locale JSON parity in test fixtures.
 *
 * A global `beforeEach(() => mockAuth.mockReset())` means tests never
 * need to reset the auth mock manually — the slate is clean every
 * `it(...)`.
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
