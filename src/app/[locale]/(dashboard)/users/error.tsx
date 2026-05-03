"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/feedback/alert";
import { Button } from "@/components/ui/primitives/button";
import { getErrorCopy } from "@/lib/error-copy";

export default function UsersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("users");
  const tErrors = useTranslations("errors");
  useEffect(() => {
    console.error("[users-error]", error);
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
          {t("detail.error.tryAgain")}
        </Button>
      </div>
    </div>
  );
}
