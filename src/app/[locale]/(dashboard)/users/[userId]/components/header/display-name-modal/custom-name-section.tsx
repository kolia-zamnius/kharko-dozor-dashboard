import { useTranslations } from "next-intl";
import { useId } from "react";

import { Input } from "@/components/ui/forms/input";
import { Button } from "@/components/ui/primitives/button";
import { useUpdateTrackedUserDisplayNameMutation } from "@/api-client/tracked-users/mutations";
import type { TrackedUserDetail } from "@/api-client/tracked-users/types";
import { useServerSyncedInput } from "./use-server-synced-input";

type CustomNameSectionProps = {
  user: TrackedUserDetail;
};

/** Priority 1 — `TrackedUser.customName`, wins over every other resolver step. Reset → `null`. */
export function CustomNameSection({ user }: CustomNameSectionProps) {
  const t = useTranslations("users.detail.displayName.custom");
  const mutation = useUpdateTrackedUserDisplayNameMutation();
  const serverValue = user.customName ?? "";
  const [value, setValue] = useServerSyncedInput(serverValue);
  const headingId = useId();

  const trimmed = value.trim();
  const canSet = trimmed.length > 0 && trimmed !== serverValue;
  const canReset = serverValue.length > 0;
  const busy = mutation.isPending;

  // Toasts via `meta.successKey` — dispatch on set vs clear via the global `MutationCache.onSuccess` handler.
  function handleSet() {
    if (!canSet) return;
    mutation.mutate({ userId: user.id, customName: trimmed });
  }

  function handleReset() {
    if (!canReset) return;
    mutation.mutate({ userId: user.id, customName: null });
  }

  return (
    <section className="space-y-2">
      <div>
        <h3 id={headingId} className="text-sm font-medium">
          {t("heading")}
        </h3>
        <p className="text-muted-foreground text-xs">{t("description")}</p>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
        <Input
          aria-labelledby={headingId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("placeholder")}
          disabled={busy}
          maxLength={120}
        />
        <Button size="sm" onClick={handleSet} disabled={!canSet || busy}>
          {t("set")}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleReset} disabled={!canReset || busy}>
          {t("reset")}
        </Button>
      </div>
    </section>
  );
}
