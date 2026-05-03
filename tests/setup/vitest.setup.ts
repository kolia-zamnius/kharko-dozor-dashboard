/**
 * Per-file setup. No global truncate — unit tests don't touch the DB and paying
 * a `TRUNCATE` round-trip for them would mask a misconfigured "unit" that secretly
 * hits Prisma. Integration files call `truncateAll(prisma)` themselves.
 *
 * `clearAllMocks` (NOT `restoreAllMocks`) — `vi.mock(...)` factories run once and
 * are cached, so `restoreAllMocks` would strip the `.mockResolvedValue(...)` primer
 * after the first test and subsequent calls would return bare `undefined`. We don't
 * use `vi.spyOn` (which IS what `restoreAllMocks` is for), so call-history clearing
 * is the only piece that needs resetting.
 */

import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.clearAllMocks();
});
