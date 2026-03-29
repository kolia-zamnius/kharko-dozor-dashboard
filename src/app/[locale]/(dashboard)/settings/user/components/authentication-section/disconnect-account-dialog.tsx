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

/**
 * Confirmation dialog for OAuth account disconnection. The destructive
 * weight here is real: removing the only sign-in method for a user could
 * lock them out of their own account, so a single accidental click should
 * never be enough.
 *
 * Each row owns its own dialog instance — the in-flight `disabled` from
 * `useDisconnectAccountMutation` naturally scopes to the row being
 * disconnected, no need for `mutation.variables === provider` matching.
 */
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
