"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/feedback/alert";
import { Spinner } from "@/components/ui/feedback/spinner";
import { CompactHeader } from "./compact-header";
import { Player } from "./player";
import { useSessionUpdateIndicator } from "./use-session-update-indicator";

type ReplayShellProps = {
  sessionId: string;
};

/**
 * `key={refreshTick}` on `<Player />` forces unmount-remount on apply — rrweb
 * has no clean re-init API that swallows a fresh event stream mid-playback.
 * The reset to t=0 is acceptable for an explicit refresh action.
 */
export function ReplayShell({ sessionId }: ReplayShellProps) {
  const t = useTranslations("replays.detail");
  const indicator = useSessionUpdateIndicator(sessionId);

  if (indicator.status === "loading") {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (indicator.status === "missing") {
    return (
      <div className="py-12">
        <Alert variant="destructive">
          <WarningCircleIcon />
          <AlertTitle>{t("missingTitle")}</AlertTitle>
          <AlertDescription>{t("missingDescription")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-6">
      <CompactHeader
        session={indicator.snapshot}
        updates={indicator.updates}
        onApply={indicator.apply}
        isApplying={indicator.isApplying}
      />
      <Player key={indicator.refreshTick} session={indicator.snapshot} />
    </div>
  );
}
