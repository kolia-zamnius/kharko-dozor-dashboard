import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { TableCell, TableRow } from "@/components/ui/data-display/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/overlays/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import { Badge } from "@/components/ui/primitives/badge";
import { cn } from "@/lib/cn";
import { trackedUserAvatarUrl } from "@/lib/avatar";
import type { TrackedUserListItem } from "@/api-client/tracked-users/types";
import { useFormatters } from "@/lib/use-formatters";
import { StatusBadge } from "./status-badge";

/** User cell de-dups `displayName`/`externalId`/`traits.email` — a project resolving display names from the `email` trait would otherwise repeat the email. */
export function UserRow({ user }: { user: TrackedUserListItem }) {
  const t = useTranslations("users.list.table");
  const { formatCount, formatDate, formatDuration, formatRelative } = useFormatters();
  const avatarUrl = trackedUserAvatarUrl({
    projectId: user.projectId,
    externalId: user.externalId,
  });

  const email = typeof user.traits?.email === "string" ? user.traits.email : null;

  // Don't show the same string twice. The title is `displayName`; the
  // sub-lines (`externalId`, `email`) only render when they add new
  // information.
  //
  // Why this matters: `displayName` walks a 4-level resolver chain
  // (customName → trait → project default → externalId), so when the
  // project's default trait key is `"email"`, `displayName` ends up
  // being the email itself — printing the email line again below
  // would duplicate the title. Same edge case for an SDK that uses
  // an email-shaped string as `externalId`.
  const showExternalId = user.displayName !== user.externalId;
  const showEmail = email !== null && email !== user.displayName && email !== user.externalId;

  return (
    <TableRow className="group">
      <TableCell>
        <Link href={`/users/${user.id}`} className="flex items-center gap-3">
          <Avatar size="default">
            <AvatarImage src={avatarUrl} alt={user.displayName} />
            <AvatarFallback>{user.externalId.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p
              className={cn(
                "text-primary truncate text-sm font-medium group-hover:underline",
                user.displayName === user.externalId && "font-mono",
              )}
            >
              {user.displayName}
            </p>
            {showExternalId && <p className="text-muted-foreground truncate font-mono text-xs">{user.externalId}</p>}
            {showEmail && <p className="text-muted-foreground truncate text-xs">{email}</p>}
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
