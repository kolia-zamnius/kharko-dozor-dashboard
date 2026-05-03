"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/primitives/button";
import { getErrorCopy } from "@/lib/error-copy";

/**
 * Network failures are handled globally by `QueryCache` → toast; this fires
 * for render errors, unhandled rejections, and anything that escapes the
 * per-segment boundaries. `getErrorCopy` differentiates by status (404 →
 * "not found", 403 → "permission denied", ...) so the user sees a specific
 * sentence instead of a generic "something went wrong".
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common.error");
  const tErrors = useTranslations("errors");
  useEffect(() => {
    console.error("[dashboard-error]", error);
  }, [error]);

  const copy = getErrorCopy(error, t("contextPage"), tErrors);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{copy.description}</p>
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
