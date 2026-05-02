"use client";

import { DotsThreeVerticalIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/overlays/dropdown-menu";
import { Button } from "@/components/ui/primitives/button";
import { DeleteSessionDialog } from "./delete-session-dialog";

export function SessionRowMenu({ sessionId }: { sessionId: string }) {
  const t = useTranslations("replays.list.rowMenu");

  return (
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
        <DeleteSessionDialog sessionId={sessionId} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
