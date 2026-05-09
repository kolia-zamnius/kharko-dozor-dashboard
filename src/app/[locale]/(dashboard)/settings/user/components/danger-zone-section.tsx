import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/layout/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { Button } from "@/components/ui/primitives/button";
import { useDeleteAccountMutation } from "@/api-client/user/mutations";
import { deleteAccountSchema, type DeleteAccountInput } from "@/api-client/user/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function DangerZoneSection() {
  const t = useTranslations("settings.user.danger");
  const deleteAccount = useDeleteAccountMutation();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<DeleteAccountInput>({ resolver: zodResolver(deleteAccountSchema), mode: "onChange" });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function onSubmit(data: DeleteAccountInput) {
    deleteAccount.mutate(data, {
      onSuccess: () => {
        // Toast comes from `useDeleteAccountMutation.meta.successKey` — briefly visible on /sign-in after redirect.
        void signOut({ redirectTo: "/sign-in" });
      },
    });
  }

  return (
    <Card className="ring-destructive/80 gap-0">
      <CardHeader>
        <CardTitle className="text-destructive">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">{t("body")}</p>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              {t("deleteButton")}
            </Button>
          </DialogTrigger>

          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t("dialogTitle")}</DialogTitle>
                <DialogDescription>{t("dialogDescription")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="delete-confirmation">{t("confirmLabel")}</Label>
                <Input
                  id="delete-confirmation"
                  placeholder={t("confirmPlaceholder")}
                  autoComplete="off"
                  aria-invalid={!!errors.confirmation}
                  aria-describedby={errors.confirmation ? "delete-account-confirmation-error" : undefined}
                  {...register("confirmation")}
                />
                {errors.confirmation && (
                  <p id="delete-account-confirmation-error" className="text-destructive text-sm">
                    {errors.confirmation.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" variant="destructive" size="sm" disabled={!isValid || deleteAccount.isPending}>
                  {t("confirm")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
