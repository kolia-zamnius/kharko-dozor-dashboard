import { Button } from "@/components/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { useRegenerateProjectKeyMutation } from "@/api-client/projects/mutations";
import type { Project } from "@/api-client/projects/types";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function RegenerateKeyDialog({ project }: { project: Project }) {
  const t = useTranslations("settings.orgs.apiKeys");
  const [open, setOpen] = useState(false);
  const regenerate = useRegenerateProjectKeyMutation();

  function handleRegenerate() {
    regenerate.mutate(project.id, { onSuccess: () => setOpen(false) });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("regenerateAria")}>
          <ArrowsClockwiseIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("regenerateTitle", { name: project.name })}</DialogTitle>
          <DialogDescription>{t("regenerateDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("regenerateCancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleRegenerate} disabled={regenerate.isPending}>
            {t("regenerateConfirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
