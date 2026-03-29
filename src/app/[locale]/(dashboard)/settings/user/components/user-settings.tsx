"use client";

import { Suspense } from "react";

import { Spinner } from "@/components/ui/feedback/spinner";
import { useUserProfileQuery } from "@/api-client/user/queries";
import { useTranslations } from "next-intl";
import { AuthenticationSection } from "./authentication-section";
import { DangerZoneSection } from "./danger-zone-section";
import { LocaleSection } from "./locale-section";
import { ProfileSection } from "./profile-section";

/**
 * Settings > User page.
 *
 * @remarks
 * Suspense composition root: the page-level fallback is a single
 * centered Spinner (preserves our "single spinner per page"
 * invariant — no per-section skeletons). Errors bubble to the
 * nearest `error.tsx`; the global `throwOnError` default in
 * `lib/query-client.ts` routes only initial-load failures to the
 * boundary, so polling flakes don't crash the page once data is on
 * screen.
 */
export function UserSettings() {
  const t = useTranslations("settings.user");
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("heading")}</h1>
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        }
      >
        <UserSettingsContent />
      </Suspense>
    </div>
  );
}

function UserSettingsContent() {
  const { data: profile } = useUserProfileQuery();

  return (
    <>
      <ProfileSection profile={profile} />
      <LocaleSection />
      <AuthenticationSection profile={profile} />
      <DangerZoneSection />
    </>
  );
}
