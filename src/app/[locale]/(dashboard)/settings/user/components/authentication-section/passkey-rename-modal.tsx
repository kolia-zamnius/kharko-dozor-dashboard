import { Button } from "@/components/ui/primitives/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/overlays/dialog";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { useRenamePasskeyMutation } from "@/api-client/user/mutations";
import { renamePasskeySchema, type RenamePasskeyInput } from "@/api-client/user/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

export function PasskeyRenameModal({
  credentialID,
  currentName,
  onClose,
}: {
  credentialID: string;
  currentName: string;
  onClose: () => void;
}) {
  const t = useTranslations("settings.user.passkeys");
  const renamePasskey = useRenamePasskeyMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<RenamePasskeyInput>({
    resolver: zodResolver(renamePasskeySchema),
    defaultValues: { name: currentName },
  });

  function onSubmit(data: RenamePasskeyInput) {
    renamePasskey.mutate({ credentialID, name: data.name }, { onSuccess: () => onClose() });
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("renameTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="passkey-name">{t("renameLabel")}</Label>
            <Input
              id="passkey-name"
              placeholder={t("renamePlaceholder")}
              autoFocus
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "passkey-name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="passkey-name-error" className="text-destructive text-sm">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={!isDirty || renamePasskey.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
