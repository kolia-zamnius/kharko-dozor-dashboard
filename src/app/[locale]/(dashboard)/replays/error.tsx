"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/feedback/alert";
import { Button } from "@/components/ui/primitives/button";
import { getErrorCopy } from "@/lib/error-copy";

/**
 * Segment-level error boundary for `/replays/*` — takes over from the
 * root dashboard boundary when a Replays-scoped query fails. Copy is
 * differentiated by {@link getErrorCopy}.
 */
export default function ReplaysError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("replays");
  const tCommon = useTranslations("common.error");
  const tErrors = useTranslations("errors");
  useEffect(() => {
    console.error("[replays-error]", error);
  }, [error]);

  const copy = getErrorCopy(error, t("errorContext.list"), tErrors);

  return (
    <div className="py-12">
      <Alert variant="destructive">
        <WarningCircleIcon />
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription>{copy.description}</AlertDescription>
      </Alert>
      <div className="mt-4 flex justify-center">
        <Button variant="outline" size="sm" onClick={reset}>
          {tCommon("tryAgain")}
        </Button>
      </div>
    </div>
  );
}
