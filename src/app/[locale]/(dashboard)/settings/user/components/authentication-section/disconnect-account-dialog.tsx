import { Button } from "@/components/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { useDisconnectAccountMutation } from "@/api-client/user/mutations";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Per-row dialog so `mutation.isPending` naturally scopes to the row being disconnected — no `variables === provider` matching. Server's last-login-method guard returns 409 if this would lock the user out. */
export function DisconnectAccountDialog({ provider, providerLabel }: { provider: string; providerLabel: string }) {
  const t = useTranslations("settings.user.accounts");
  const [open, setOpen] = useState(false);
  const disconnectAccount = useDisconnectAccountMutation();

  function handleDisconnect() {
    disconnectAccount.mutate(provider, { onSuccess: () => setOpen(false) });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          {t("disconnect")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("confirmTitle", { provider: providerLabel })}</DialogTitle>
          <DialogDescription>{t("confirmDescription", { provider: providerLabel })}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnectAccount.isPending}>
            {t("disconnect")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
