import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { Button } from "@/components/ui/primitives/button";
import { useDeleteOrgMutation } from "@/api-client/organizations/mutations";
import type { Organization } from "@/api-client/organizations/schemas";
import { deleteOrgSchema, type DeleteOrgInput } from "@/api-client/organizations/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { TrashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function DeleteOrgDialog({ org }: { org: Organization }) {
  const t = useTranslations("settings.orgs.card");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("deleteAria")} className="text-destructive">
          <TrashIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>{open && <DeleteOrgContent org={org} close={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function DeleteOrgContent({ org, close }: { org: Organization; close: () => void }) {
  const t = useTranslations("settings.orgs.delete");
  const deleteOrg = useDeleteOrgMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<DeleteOrgInput>({ resolver: zodResolver(deleteOrgSchema), mode: "onChange" });

  function onSubmit() {
    deleteOrg.mutate(org.id, { onSuccess: () => close() });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t("title", { orgName: org.name })}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="delete-org-confirmation">{t("confirmLabel")}</Label>
        <Input
          id="delete-org-confirmation"
          placeholder={t("confirmPlaceholder")}
          autoComplete="off"
          aria-invalid={!!errors.confirmation}
          aria-describedby={errors.confirmation ? "delete-org-confirmation-error" : undefined}
          {...register("confirmation")}
        />
        {errors.confirmation && (
          <p id="delete-org-confirmation-error" className="text-destructive text-sm">
            {errors.confirmation.message}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close}>
          {t("cancel")}
        </Button>
        <Button type="submit" variant="destructive" size="sm" disabled={!isValid || deleteOrg.isPending}>
          {t("confirm")}
        </Button>
      </div>
    </form>
  );
}
