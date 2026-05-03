/**
 * Stateful auth mock handle. The `vi.mock("@/server/auth", …)` registration
 * lives in `tests/setup/integration-mocks.ts` (must hoist), this file only
 * exports the handle that test bodies call `.mockResolvedValue(...)` on.
 *
 * Auto-reset before every integration test via `beforeEach` in the same
 * setup file — tests don't `mockReset` manually.
 */

import type { Session } from "next-auth";
import { vi } from "vitest";

/**
 * Typed as bare zero-arg to bypass NextAuth v5's `NextMiddleware` overload that
 * `vi.mocked(auth)` would otherwise pick up.
 */
export const mockAuth = vi.fn<() => Promise<Session | null>>();
