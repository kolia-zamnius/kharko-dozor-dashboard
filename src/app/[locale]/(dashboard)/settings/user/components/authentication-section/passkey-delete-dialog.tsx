import { Button } from "@/components/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { useDeletePasskeyMutation } from "@/api-client/user/mutations";
import type { UserPasskey } from "@/api-client/user/types";
import { TrashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * Confirmation dialog for passkey deletion. Wraps the trash button so the
 * action requires an explicit second click — passkeys are easy to recreate
 * but easy to delete by accident, and the previous one-click flow let
 * users wipe credentials without realising it.
 *
 * Each row owns its own dialog instance — no global state in the parent
 * list, which means the in-flight `disabled` from `useDeletePasskeyMutation`
 * naturally scopes to the row being deleted.
 */
export function PasskeyDeleteDialog({ passkey }: { passkey: UserPasskey }) {
  const t = useTranslations("settings.user.passkeys");
  const [open, setOpen] = useState(false);
  const deletePasskey = useDeletePasskeyMutation();

  function handleDelete() {
    deletePasskey.mutate(passkey.credentialID, { onSuccess: () => setOpen(false) });
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
          <DialogTitle>{t("deleteTitle", { name: passkey.name })}</DialogTitle>
          <DialogDescription>{t("deleteDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deletePasskey.isPending}>
            {t("delete")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
