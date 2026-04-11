/**
 * Per-test-file setup — runs once per test file after `load-env.ts`.
 *
 * @remarks
 * Deliberately minimal. Per-test DB truncation is NOT global because unit
 * tests don't need the DB and paying a `TRUNCATE` round-trip for them
 * would waste time and mask misconfigurations (e.g. a "unit" test that
 * accidentally hits Prisma). Integration test files call
 * `beforeEach(() => truncateAll(prisma))` explicitly via the `db.ts`
 * helper.
 *
 * `afterEach` uses `clearAllMocks` — NOT `restoreAllMocks`. The
 * distinction matters because of how we set up module mocks:
 *
 *   vi.mock("@/server/mailer", () => ({
 *     sendMail: vi.fn().mockResolvedValue(undefined),
 *   }));
 *
 * The factory runs ONCE (vitest hoists + caches). The `.mockResolvedValue`
 * primes the mock's return for every call. `restoreAllMocks` strips that
 * primer — after the first test finishes, subsequent `sendMail(...)` calls
 * return bare `undefined` and the route's `.then(...)` chain blows up.
 * `clearAllMocks` only wipes call history (`.mock.calls`, `.mock.results`),
 * leaving the configured behaviour intact — the correct trade-off for a
 * suite that relies exclusively on `vi.mock(...)` factories and never on
 * `vi.spyOn` (which IS what `restoreAllMocks` was designed for).
 */

import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.clearAllMocks();
});
