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
 * Composition root for the replay page.
 *
 * Delegates snapshot / latest / diff bookkeeping to
 * `useSessionUpdateIndicator`. This component only worries about the
 * three top-level render states (loading, missing, ready) and wires
 * the indicator's outputs into `CompactHeader` (refresh button) and
 * `Player` (stable snapshot + `key`-based remount on apply).
 *
 * The `key={indicator.refreshTick}` on `<Player />` is a pragmatic
 * unmount-remount trigger: rrweb's `Replayer` has no clean
 * re-initialize API that safely swallows a fresh event stream mid-
 * playback, so we tear the whole subtree down and re-init on the new
 * snapshot. The admin already understands this — the refresh button's
 * tooltip advertises it — and resetting to `t=0` is acceptable for an
 * explicit user action.
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
