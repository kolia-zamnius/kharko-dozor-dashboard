"use client";

import { DotsThreeVerticalIcon, TrashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlays/dropdown-menu";
import { Button } from "@/components/ui/primitives/button";
import { DeleteSessionDialog } from "./delete-session-dialog";

type SessionRowMenuProps = {
  sessionId: string;
};

export function SessionRowMenu({ sessionId }: SessionRowMenuProps) {
  const t = useTranslations("replays.list.rowMenu");
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-7"
            aria-label={t("triggerAria")}
            onClick={(e) => e.stopPropagation()}
          >
            <DotsThreeVerticalIcon size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-full">
          <DropdownMenuItem onSelect={() => setShowDelete(true)} className="text-destructive">
            <TrashIcon size={14} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteSessionDialog sessionId={sessionId} open={showDelete} onOpenChange={setShowDelete} />
    </>
  );
}
