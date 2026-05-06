import { BuildingsIcon, CalendarPlusIcon, StackIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/layout/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import { Badge } from "@/components/ui/primitives/badge";
import { Kbd } from "@/components/ui/primitives/kbd";
import type { TrackedUserDetail } from "@/api-client/tracked-users/types";
import { trackedUserAvatarUrl } from "@/lib/avatar";
import { useFormatters } from "@/lib/use-formatters";
import { DisplayNameModal } from "./display-name-modal";
import { OnlineIndicator } from "./online-indicator";

type UserHeaderProps = {
  user: TrackedUserDetail;
  /** Gates the edit-display-name trigger. Route is ADMIN-guarded; rendering for viewers would only surface a 403 toast. */
  canManage: boolean;
};

export function UserHeader({ user, canManage }: UserHeaderProps) {
  const t = useTranslations("users.detail.header");
  const { formatDate } = useFormatters();
  const initials = user.externalId.slice(0, 2).toUpperCase();

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar size="lg" className="size-12">
            <AvatarImage
              src={trackedUserAvatarUrl({ projectId: user.projectId, externalId: user.externalId })}
              alt=""
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* `displayName` is resolved server-side from the 4-level
                  fallback chain — custom name → local trait key → project
                  trait key → externalId. The pencil button opens the editor
                  modal for all three levels. */}
              <h1 className="text-primary truncate font-mono text-base font-semibold" title={user.displayName}>
                {user.displayName}
              </h1>
              {canManage && <DisplayNameModal user={user} />}
              <OnlineIndicator userId={user.id} fallbackLastSeenAt={user.lastEventAt} />
            </div>
            <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
              {t("prefix")}
              <Kbd>{user.externalId}</Kbd>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <BuildingsIcon weight="regular" />
            {user.projectName}
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <CalendarPlusIcon weight="regular" />
            {t("firstSeen", { date: formatDate(user.createdAt) })}
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <StackIcon weight="regular" />
            {t("sessionCount", { count: user.sessionCount })}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
