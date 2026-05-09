import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import { Button } from "@/components/ui/primitives/button";
import { Separator } from "@/components/ui/primitives/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlays/dialog";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { useUpdateOrgMutation } from "@/api-client/organizations/mutations";
import type { Organization } from "@/api-client/organizations/schemas";
import { createOrgSchema, type CreateOrgInput } from "@/api-client/organizations/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowsClockwiseIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function EditOrgModal({ org }: { org: Organization }) {
  const t = useTranslations("settings.orgs.card");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("editAria")}>
          <PencilSimpleIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>{open && <EditOrgContent org={org} close={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function EditOrgContent({ org, close }: { org: Organization; close: () => void }) {
  const t = useTranslations("settings.orgs.edit");
  const updateOrg = useUpdateOrgMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid },
  } = useForm<CreateOrgInput>({
    resolver: zodResolver(createOrgSchema),
    values: { name: org.name },
    mode: "onChange",
  });

  // Toasts for both ops come from `useUpdateOrgMutation`'s dynamic
  // `meta.successKey` — it picks "Organization updated" vs
  // "Avatar regenerated" based on whether `regenerateAvatar` is set.
  function onSubmitName(data: CreateOrgInput) {
    updateOrg.mutate({ orgId: org.id, name: data.name }, { onSuccess: () => close() });
  }

  function onRegenerateAvatar() {
    updateOrg.mutate({ orgId: org.id, regenerateAvatar: true });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar size="lg" className="size-14">
            <AvatarImage src={org.image} alt={org.name} />
            <AvatarFallback>{org.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm" onClick={onRegenerateAvatar} disabled={updateOrg.isPending}>
            <ArrowsClockwiseIcon />
            {t("regenerateAvatar")}
          </Button>
        </div>

        <Separator />

        <form onSubmit={handleSubmit(onSubmitName)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">{t("nameLabel")}</Label>
            <Input
              id="org-name"
              placeholder={t("namePlaceholder")}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "edit-org-name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="edit-org-name-error" className="text-destructive text-sm">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={close}>
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={!isDirty || !isValid || updateOrg.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
