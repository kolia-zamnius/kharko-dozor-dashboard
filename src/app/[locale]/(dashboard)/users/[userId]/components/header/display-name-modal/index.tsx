import { PencilSimpleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { Separator } from "@/components/ui/primitives/separator";
import type { TrackedUserDetail } from "@/api-client/tracked-users/types";
import { CustomNameSection } from "./custom-name-section";
import { LocalTraitKeySection } from "./local-trait-key-section";
import { ProjectTraitKeySection } from "./project-trait-key-section";

type DisplayNameModalProps = {
  user: TrackedUserDetail;
};

/**
 * Three independently-savable sections matching the resolver priority — no
 * "save all" button. Sections re-sync inputs to fresh server state via
 * `useServerSyncedInput` after every mutation.
 */
export function DisplayNameModal({ user }: DisplayNameModalProps) {
  const tHeader = useTranslations("users.detail.header");
  const t = useTranslations("users.detail.displayName");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={tHeader("editAria")} title={tHeader("editAria")}>
          <PencilSimpleIcon weight="regular" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <CustomNameSection user={user} />
        <Separator />
        <LocalTraitKeySection user={user} />
        <Separator />
        <ProjectTraitKeySection user={user} />
      </DialogContent>
    </Dialog>
  );
}
