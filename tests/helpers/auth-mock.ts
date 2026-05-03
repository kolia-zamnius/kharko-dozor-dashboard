/**
 * Builders for `Session` shape returned by `auth()`. Defaults match what the
 * production JWT/session callbacks produce post-sign-in, so test bodies only
 * pass the fields they actually exercise.
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

/** Expiry one hour out so slow CI machines don't trip the NextAuth expiry check. */
export function buildSession(user: SessionUser): Session {
  return {
    user,
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}
