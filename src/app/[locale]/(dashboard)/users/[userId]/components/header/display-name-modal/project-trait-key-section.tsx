import { useTranslations } from "next-intl";
import { useId } from "react";

import { Input } from "@/components/ui/forms/input";
import { Button } from "@/components/ui/primitives/button";
import { useUpdateProjectDisplayNameTraitKeyMutation } from "@/api-client/projects/mutations";
import type { TrackedUserDetail } from "@/api-client/tracked-users/types";
import { useServerSyncedInput } from "./use-server-synced-input";

type ProjectTraitKeySectionProps = {
  user: TrackedUserDetail;
};

/**
 * Priority-3 editor: project-wide default trait key.
 *
 * Unlike the other two sections, this one mutates a `Project` field rather
 * than `TrackedUser` — it applies to every user in the project that
 * doesn't have a local override. The mutation's `onSuccess` invalidates
 * the entire `["tracked-users", "detail"]` query scope, so any currently
 * mounted user detail refetches and picks up the new resolved
 * `displayName` side-effect-style.
 */
export function ProjectTraitKeySection({ user }: ProjectTraitKeySectionProps) {
  const t = useTranslations("users.detail.displayName.project");
  const mutation = useUpdateProjectDisplayNameTraitKeyMutation();
  const serverValue = user.projectDisplayNameTraitKey ?? "";
  const [value, setValue] = useServerSyncedInput(serverValue);
  const headingId = useId();

  const trimmed = value.trim();
  const canSet = trimmed.length > 0 && trimmed !== serverValue;
  const canReset = serverValue.length > 0;
  const busy = mutation.isPending;

  function handleSet() {
    if (!canSet) return;
    mutation.mutate({ projectId: user.projectId, traitKey: trimmed });
  }

  function handleReset() {
    if (!canReset) return;
    mutation.mutate({ projectId: user.projectId, traitKey: null });
  }

  return (
    <section className="space-y-2">
      <div>
        <h3 id={headingId} className="text-sm font-medium">
          {t("heading")}
        </h3>
        <p className="text-muted-foreground text-xs">
          {t.rich("description", {
            strong: () => <strong>every user</strong>,
            projectName: () => <span className="font-medium">{user.projectName}</span>,
            code: () => <code className="font-mono">email</code>,
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
    </section>
  );
}
