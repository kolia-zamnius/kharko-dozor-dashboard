/**
 * Controlled mock state shared across integration tests.
 *
 * @remarks
 * This file ONLY declares the stateful `mockAuth` handle. The `vi.mock`
 * wiring that installs it lives in `tests/setup/integration-mocks.ts`
 * as a Vitest setup file — scoped to the integration project so unit
 * tests stay free of any auth/Prisma/intl mocking.
 *
 * Split rationale: `vi.mock` calls must hoist to the top of their
 * module, but test files need to IMPORT the `mockAuth` handle at
 * runtime (`mockAuth.mockResolvedValue(session)`). Keeping the
 * exported handle in a plain module file (this one) and the
 * mock-registration in a setup file (the other one) gives each
 * concern the module shape it wants:
 *
 *   - `mocks.ts` — top-level `vi.fn()`, regular import target.
 *   - `integration-mocks.ts` — `vi.mock(...)` calls hoisted, run once
 *     per test file before test code executes.
 *
 * `mockAuth` is reset before every integration test via a
 * `beforeEach` in `integration-mocks.ts`, so tests don't need to
 * `mockAuth.mockReset()` manually.
 */

import type { Session } from "next-auth";
import { vi } from "vitest";

/**
 * The `auth()` call is mocked globally for integration tests. Set a
 * per-case return value with `mockAuth.mockResolvedValue(session)` or
 * `mockAuth.mockResolvedValue(null)` for the anonymous path. Typed as
 * a bare zero-arg function to bypass NextAuth v5's `NextMiddleware`
 * overload which `vi.mocked(auth)` would otherwise pick up.
 */
export const mockAuth = vi.fn<() => Promise<Session | null>>();
