/**
 * Helpers for mocking `@/server/auth::auth()` in route-handler tests.
 *
 * @remarks
 * Usage pattern in an integration test file:
 *
 * ```ts
 * import { vi } from "vitest";
 * vi.mock("@/server/auth", () => ({ auth: vi.fn() }));
 *
 * import { auth } from "@/server/auth";
 * import { buildSession, buildSessionUser } from "tests/helpers/auth-mock";
 *
 * beforeEach(() => {
 *   vi.mocked(auth).mockResolvedValue(buildSession(buildSessionUser({ id: alice.id })));
 * });
 * ```
 *
 * `vi.mock` is hoisted to the top of the file by Vitest — the factory
 * must not reference anything that isn't either hoisted or imported
 * at module load. That's why we export plain builders here rather than
 * a "do everything" helper that would need to `vi.mock` itself.
 *
 * @see src/types/next-auth.d.ts — canonical `Session["user"]` shape.
 */

import type { Session } from "next-auth";

import type { Locale } from "@/i18n/config";
import type { UserId } from "@/types/ids";

type SessionUser = Session["user"];

type SessionUserOverrides = {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  activeOrganizationId?: string | null;
  locale?: Locale;
};

/**
 * Build a fully-formed `Session["user"]` from partial overrides. Every
 * optional field gets a deterministic default so the session matches what
 * the production JWT/session callbacks would produce post-sign-in.
 */
export function buildSessionUser(overrides: SessionUserOverrides): SessionUser {
  return {
    id: overrides.id as UserId,
    email: overrides.email ?? `${overrides.id}@test.local`,
    name: overrides.name ?? "",
    image: overrides.image ?? "https://example.invalid/avatar.png",
    activeOrganizationId: overrides.activeOrganizationId ?? null,
    locale: overrides.locale ?? "en",
  };
}

/**
 * Wrap a `SessionUser` in the full `Session` envelope `auth()` returns.
 * Expiry set an hour out so tests running slow machines don't trip the
 * NextAuth expiry check.
 */
export function buildSession(user: SessionUser): Session {
  return {
    user,
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}
