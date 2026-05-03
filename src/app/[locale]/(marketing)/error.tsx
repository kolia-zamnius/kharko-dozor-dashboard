"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/primitives/button";

/**
 * Skips `getErrorCopy` — marketing never calls `apiFetch`, no `ApiError` to
 * narrow on. `digest` is Next.js's server-side error fingerprint for
 * correlating a user report with the production log.
 */
export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common.error");

  useEffect(() => {
    console.error("[marketing-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("contextPage")}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{error.message || t("tryAgain")}</p>
      {error.digest && (
        <p className="text-muted-foreground mt-1 font-mono text-xs">{t("errorId", { id: error.digest })}</p>
      )}
      <Button className="mt-6" onClick={reset}>
        <ArrowClockwiseIcon />
        {t("tryAgain")}
      </Button>
    </div>
  );
}
