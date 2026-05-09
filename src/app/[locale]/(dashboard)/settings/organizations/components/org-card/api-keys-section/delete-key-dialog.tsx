import { Button } from "@/components/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { useDeleteProjectMutation } from "@/api-client/projects/mutations";
import type { Project } from "@/api-client/projects/schemas";
import { TrashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function DeleteKeyDialog({ project }: { project: Project }) {
  const t = useTranslations("settings.orgs.apiKeys");
  const [open, setOpen] = useState(false);
  const deleteProject = useDeleteProjectMutation();

  function handleDelete() {
    deleteProject.mutate(project.id, { onSuccess: () => setOpen(false) });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("deleteAria")} className="text-destructive">
          <TrashIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteTitle", { name: project.name })}</DialogTitle>
          <DialogDescription>
            {t("deleteDescriptionPrefix")}
            <strong>{t("deleteDescriptionStrong")}</strong>
            {t("deleteDescriptionSuffix")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("deleteCancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteProject.isPending}>
            {t("deleteConfirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
