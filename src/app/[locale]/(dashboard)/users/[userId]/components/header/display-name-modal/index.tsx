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
 * Editor for the 4-level display-name resolver chain. One modal, three
 * independently-savable sections (matching the resolver priority top → bottom):
 *   1. {@link CustomNameSection}       — this user only, explicit override
 *   2. {@link LocalTraitKeySection}    — this user only, `traits[key]`
 *   3. {@link ProjectTraitKeySection}  — every user in the project, `traits[key]`
 *
 * Each section owns its local input state, its mutation, and its set/reset
 * actions — there is no "save all" button. Sections re-sync their inputs
 * to fresh server state after every successful mutation via the
 * {@link useServerSyncedInput} hook.
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
