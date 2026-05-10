import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/primitives/button";

/**
 * `getTranslations` (not the hook) — when `notFound()` fires from inside
 * `[locale]/layout.tsx`, the client provider chain may not be mounted.
 * Hard nav `<a href>` so middleware re-runs (soft nav can leave the 404 UI
 * mounted after the router advances).
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("common.notFound");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t("description")}</p>
      <Button asChild className="mt-6">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard nav so proxy re-runs */}
        <a href="/replays">{t("goToDashboard")}</a>
      </Button>
    </div>
  );
}
