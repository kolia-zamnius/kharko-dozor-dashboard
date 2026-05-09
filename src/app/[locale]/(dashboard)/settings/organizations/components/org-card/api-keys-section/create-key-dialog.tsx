import { Button } from "@/components/ui/primitives/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlays/dialog";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { useCreateProjectMutation } from "@/api-client/projects/mutations";
import { createProjectSchema, type CreateProjectInput } from "@/api-client/projects/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function CreateKeyDialog({ organizationId }: { organizationId: string }) {
  const t = useTranslations("settings.orgs.apiKeys");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon />
          {t("addButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {open && <CreateKeyContent organizationId={organizationId} close={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateKeyContent({ organizationId, close }: { organizationId: string; close: () => void }) {
  const t = useTranslations("settings.orgs.apiKeys");
  const createProject = useCreateProjectMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", organizationId },
    mode: "onChange",
  });

  function onSubmit(data: CreateProjectInput) {
    createProject.mutate({ name: data.name, organizationId }, { onSuccess: () => close() });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("createTitle")}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="key-name">{t("createNameLabel")}</Label>
          <Input
            id="key-name"
            placeholder={t("createNamePlaceholder")}
            autoFocus
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "key-name-error" : undefined}
            {...register("name")}
          />
          {errors.name && (
            <p id="key-name-error" className="text-destructive text-sm">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={close}>
            {t("createCancel")}
          </Button>
          <Button type="submit" size="sm" disabled={!isValid || createProject.isPending}>
            {t("createConfirm")}
          </Button>
        </div>
      </form>
    </>
  );
}
