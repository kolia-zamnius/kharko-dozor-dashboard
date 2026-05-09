import { useTranslations } from "next-intl";
import { useId } from "react";

import { Input } from "@/components/ui/forms/input";
import { Button } from "@/components/ui/primitives/button";
import { useUpdateTrackedUserDisplayNameMutation } from "@/api-client/tracked-users/mutations";
import type { TrackedUserDetail } from "@/api-client/tracked-users/schemas";
import { useServerSyncedInput } from "./use-server-synced-input";

type LocalTraitKeySectionProps = {
  user: TrackedUserDetail;
};

/** Priority 2 — per-user `traits[traitKey]` lookup. Click-to-fill hint shows actual trait keys so admins don't type by hand. */
export function LocalTraitKeySection({ user }: LocalTraitKeySectionProps) {
  const t = useTranslations("users.detail.displayName.local");
  const mutation = useUpdateTrackedUserDisplayNameMutation();
  const serverValue = user.displayNameTraitKey ?? "";
  const [value, setValue] = useServerSyncedInput(serverValue);
  const headingId = useId();

  const trimmed = value.trim();
  const canSet = trimmed.length > 0 && trimmed !== serverValue;
  const canReset = serverValue.length > 0;
  const busy = mutation.isPending;

  // Surface the user's actual trait keys as quick-fill chips. Filter out
  // null/empty values so we don't advertise keys whose value would still
  // fall through the resolver chain anyway.
  const availableKeys =
    user.traits && typeof user.traits === "object"
      ? Object.keys(user.traits).filter((k) => user.traits?.[k] != null && user.traits[k] !== "")
      : [];

  function handleSet() {
    if (!canSet) return;
    mutation.mutate({ userId: user.id, traitKey: trimmed });
  }

  function handleReset() {
    if (!canReset) return;
    mutation.mutate({ userId: user.id, traitKey: null });
  }

  return (
    <section className="space-y-2">
      <div>
        <h3 id={headingId} className="text-sm font-medium">
          {t("heading")}
        </h3>
        <p className="text-muted-foreground text-xs">
          {t.rich("description", {
            code: () => <code className="font-mono">traits</code>,
            codeValue: () => <code className="font-mono">traits[key]</code>,
          })}
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
        <Input
          aria-labelledby={headingId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("placeholder")}
          disabled={busy}
          maxLength={60}
        />
        <Button size="sm" onClick={handleSet} disabled={!canSet || busy}>
          {t("set")}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleReset} disabled={!canReset || busy}>
          {t("reset")}
        </Button>
      </div>

      {availableKeys.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {t("available")}
          {availableKeys.map((k, i) => (
            <span key={k}>
              {i > 0 && ", "}
              <button
                type="button"
                onClick={() => setValue(k)}
                disabled={busy}
                className="cursor-pointer font-mono underline-offset-2 hover:underline disabled:pointer-events-none"
              >
                {k}
              </button>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
