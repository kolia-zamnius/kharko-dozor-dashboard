"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/primitives/button";

/**
 * Marketing-zone error boundary — mounts when anything in
 * `src/app/[locale]/(marketing)/**` throws during render.
 *
 * @remarks
 * Matches the dashboard error.tsx shape (centred card, try-again
 * button, error id) but skips the `getErrorCopy` mapping — marketing
 * never calls `apiFetch`, so there's no `ApiError` discriminated
 * union to narrow on, and every failure here is effectively a
 * rendering bug. A generic "something went wrong" message + retry
 * is the right recovery affordance.
 *
 * `digest` is Next.js's server-side error fingerprint; logging it
 * in the overlay lets the author correlate a user report with a
 * specific production log line.
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
