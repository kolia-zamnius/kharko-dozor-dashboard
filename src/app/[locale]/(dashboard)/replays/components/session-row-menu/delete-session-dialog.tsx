import { useTranslations } from "next-intl";

import { useDeleteSessionMutation } from "@/api-client/sessions/mutations";
import { Button } from "@/components/ui/primitives/button";
import { Spinner } from "@/components/ui/feedback/spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/overlays/dialog";

type DeleteSessionDialogProps = {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Destructive confirmation dialog for deleting a session.
 * Uses the project's Radix Dialog with a destructive action button
 * pattern (no AlertDialog, no DialogFooter).
 */
export function DeleteSessionDialog({ sessionId, open, onOpenChange }: DeleteSessionDialogProps) {
  const t = useTranslations("replays.list.deleteDialog");
  const deleteSession = useDeleteSessionMutation();

  function handleDelete() {
    deleteSession.mutate(sessionId, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
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
