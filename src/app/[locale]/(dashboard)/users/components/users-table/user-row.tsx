import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { TableCell, TableRow } from "@/components/ui/data-display/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/overlays/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import { Badge } from "@/components/ui/primitives/badge";
import { trackedUserAvatarUrl } from "@/lib/avatar";
import type { TrackedUserListItem } from "@/api-client/tracked-users/types";
import { useFormatters } from "@/lib/use-formatters";
import { StatusBadge } from "./status-badge";

/**
 * Single row in the users table. Pure view — receives a tracked user
 * and renders avatar, name, project badge, status, last seen, sessions,
 * and active time. The whole row is a link to the user detail page.
 */
export function UserRow({ user }: { user: TrackedUserListItem }) {
  const t = useTranslations("users.list.table");
  const { formatCount, formatDate, formatDuration, formatRelative } = useFormatters();
  const avatarUrl = trackedUserAvatarUrl({
    projectId: user.projectId,
    externalId: user.externalId,
  });

  const email = typeof user.traits?.email === "string" ? user.traits.email : null;

  // When displayName is the externalId fallback, avoid showing the same
  // string twice. Matches the UserHeader pattern on the detail page.
  const hasResolvedName = user.displayName !== user.externalId;

  return (
    <TableRow className="group">
      <TableCell>
        <Link href={`/users/${user.id}`} className="flex items-center gap-3">
          <Avatar size="default">
            <AvatarImage src={avatarUrl} alt={user.displayName} />
            <AvatarFallback>{user.externalId.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium group-hover:underline">{user.displayName}</p>
            {hasResolvedName && <p className="text-muted-foreground truncate font-mono text-xs">{user.externalId}</p>}
            {email && <p className="text-muted-foreground truncate text-xs">{email}</p>}
          </div>
        </Link>
      </TableCell>

      <TableCell>
        <Badge variant="secondary">{user.projectName}</Badge>
      </TableCell>

      <TableCell>
        <StatusBadge status={user.status} />
      </TableCell>

      <TableCell>
        {user.lastEventAt ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground cursor-default text-sm">{formatRelative(user.lastEventAt)}</span>
              </TooltipTrigger>
              <TooltipContent>{formatDate(user.lastEventAt)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-muted-foreground text-sm">{t("emptyDash")}</span>
        )}
      </TableCell>

      <TableCell>
        <span className="text-muted-foreground text-sm tabular-nums">{formatCount(user.sessionCount)}</span>
      </TableCell>

      <TableCell>
        <span className="text-muted-foreground text-sm tabular-nums">
          {user.activeTime7d > 0 ? formatDuration(user.activeTime7d) : t("emptyDash")}
        </span>
      </TableCell>
    </TableRow>
  );
}
