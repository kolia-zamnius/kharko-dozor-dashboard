import { TrashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useDeleteSessionMutation } from "@/api-client/sessions/mutations";
import { Button } from "@/components/ui/primitives/button";
import { Spinner } from "@/components/ui/feedback/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { DropdownMenuItem } from "@/components/ui/overlays/dropdown-menu";

/**
 * Destructive confirmation dialog for deleting a session — owns its
 * own `open` state and renders the dropdown's trigger row internally,
 * so callers don't have to thread `open`/`onOpenChange` through the
 * row menu. Matches the self-controlled pattern used by every other
 * dialog in the codebase (`MemberRemoveDialog`, `DisconnectAccountDialog`,
 * `MembersModal`, etc.).
 *
 * @remarks
 * `<DialogTrigger asChild>` wraps a `DropdownMenuItem` with a
 * `preventDefault` on `onSelect` — the standard Radix pattern for
 * letting a menu item open a dialog without the dropdown auto-closing
 * underneath it.
 */
export function DeleteSessionDialog({ sessionId }: { sessionId: string }) {
  const t = useTranslations("replays.list.deleteDialog");
  const tMenu = useTranslations("replays.list.rowMenu");
  const [open, setOpen] = useState(false);
  const deleteSession = useDeleteSessionMutation();

  function handleDelete() {
    deleteSession.mutate(sessionId, { onSuccess: () => setOpen(false) });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
          <TrashIcon size={14} />
          {tMenu("delete")}
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteSession.isPending}>
            {deleteSession.isPending && <Spinner className="mr-1.5 size-3.5" aria-hidden />}
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
