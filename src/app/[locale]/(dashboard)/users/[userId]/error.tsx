"use client";

import { ArrowClockwiseIcon, ArrowLeftIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/primitives/button";
import { getErrorCopy } from "@/lib/error-copy";

/**
 * Route-level error boundary for `/users/[userId]`. Takes over from the
 * parent `(dashboard)/error.tsx` when a render error happens anywhere
 * in the user detail tree — isolates the failure so the navbar and
 * other routes stay interactive.
 *
 * @remarks
 * Copy is differentiated by {@link getErrorCopy} — 404 reads as "User
 * not found", 403 as "permission denied", etc. The "back to users"
 * escape hatch is preserved for any error kind so the admin is never
 * trapped. Most errors here come from the shell's Suspense queries
 * failing their initial load; background polling flakes stay in the
 * toast pipeline per the global `throwOnError` policy.
 */
export default function UserDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("users");
  const tErrors = useTranslations("errors");
  useEffect(() => {
    console.error("[user-detail-error]", error);
  }, [error]);

  const copy = getErrorCopy(error, t("errorContext.detail"), tErrors);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{copy.description}</p>
      {error.digest && (
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          {t("detail.error.errorId", { id: error.digest })}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/users">
            <ArrowLeftIcon />
            {t("detail.error.backButton")}
          </Link>
        </Button>
        <Button onClick={reset}>
          <ArrowClockwiseIcon />
          {t("detail.error.tryAgain")}
        </Button>
      </div>
    </div>
  );
}
