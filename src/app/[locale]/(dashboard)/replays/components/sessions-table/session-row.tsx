import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/primitives/badge";
import { TableCell, TableRow } from "@/components/ui/data-display/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/overlays/tooltip";
import type { SessionListItem } from "@/api-client/sessions/types";
import { useFormatters } from "@/lib/use-formatters";
import { SessionRowMenu } from "../session-row-menu";

type SessionRowProps = {
  session: SessionListItem;
  canManage: boolean;
};

/**
 * Single row in the sessions table. Pure view — receives a session
 * and renders session ID link, user, project badge, pages, duration,
 * and date. Optional actions column for admins/owners.
 */
export function SessionRow({ session, canManage }: SessionRowProps) {
  const t = useTranslations("replays.list.table");
  const { formatDate, formatDuration, formatRelative } = useFormatters();
  return (
    <TableRow className="group">
      <TableCell>
        <Link href={`/replays/${session.id}`} className="text-foreground font-mono text-sm group-hover:underline">
          {session.externalId}
        </Link>
      </TableCell>

      <TableCell>
        {session.trackedUserId && session.userDisplayName ? (
          <Link href={`/users/${session.trackedUserId}`} className="min-w-0 hover:underline">
            <p className="truncate text-sm">{session.userDisplayName}</p>
            {/* Show externalId subtitle only when displayName was resolved
                from a real source (customName / trait), not the externalId fallback. */}
            {session.userId && session.userDisplayName !== session.userId && (
              <p className="text-muted-foreground truncate font-mono text-xs">{session.userId}</p>
            )}
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">{t("emptyDash")}</span>
        )}
      </TableCell>

      <TableCell>
        <Badge variant="secondary">{session.projectName}</Badge>
      </TableCell>

      <TableCell>
        <span className="text-muted-foreground text-sm tabular-nums">{session.sliceCount}</span>
      </TableCell>

      <TableCell>
        <span className="text-muted-foreground text-sm tabular-nums">
          {session.duration > 0 ? formatDuration(session.duration) : t("emptyDash")}
        </span>
      </TableCell>

      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground cursor-default text-sm">{formatRelative(session.createdAt)}</span>
            </TooltipTrigger>
            <TooltipContent>{formatDate(session.createdAt)}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>

      {canManage && (
        <TableCell className="w-10">
          <SessionRowMenu sessionId={session.id} />
        </TableCell>
      )}
    </TableRow>
  );
}
