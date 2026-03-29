import { Card, CardContent } from "@/components/ui/layout/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import { Badge } from "@/components/ui/primitives/badge";
import type { Organization } from "@/api-client/organizations/types";
import { useFormatters } from "@/lib/use-formatters";
import { useTranslations } from "next-intl";
import { ApiKeysSection } from "./api-keys-section";
import { DeleteOrgDialog } from "./delete-org-dialog";
import { EditOrgModal } from "./edit-org-modal";
import { InviteModal } from "./invite-modal";
import { LeaveOrgDialog } from "./leave-org-dialog";
import { MembersModal } from "./members-modal";

/**
 * Card rendering a single organization membership on
 * `/settings/organizations`.
 *
 * @remarks
 * Derives its own per-membership capability booleans from the row's
 * `role` + `type` — this is the client half of the double-validation
 * contract (UI hides what the API will 403 anyway). Keeps role
 * derivation colocated with the per-row UI instead of threading four
 * booleans down from the parent shell, which would prop-drill and
 * couple the shell to every consumer's capability needs.
 *
 * Composes the four per-membership actions (`EditOrgModal`,
 * `InviteModal`, `DeleteOrgDialog`, `LeaveOrgDialog`) plus an
 * `ApiKeysSection` that renders inline for team orgs only (keys live
 * on projects, which live on organizations).
 *
 * @see src/server/auth/permissions.ts — server-side RBAC source of
 *   truth; this component mirrors the matrix defined there.
 */
export function OrganizationCard({ org }: { org: Organization }) {
  const t = useTranslations("settings.orgs.card");
  const { formatDate, formatRole } = useFormatters();
  const isPersonal = org.type === "PERSONAL";
  const isOwner = org.role === "OWNER";
  const isAdmin = org.role === "ADMIN";

  /**
   * Per-membership capability matrix (mirrored from `permissions.ts`):
   *   - `canEdit`   — rename / avatar regen. OWNER + ADMIN, both are
   *      allowed non-destructive edits.
   *   - `canInvite` — send + manage pending invites. OWNER only;
   *      invite lifecycle (who joins, with what role, for how long)
   *      is the highest-sensitivity governance action, above ADMIN-
   *      level settings maintenance.
   *   - `canLeave`  — self-remove. Anyone except the owner (owners
   *      must delete the org or transfer ownership first) on a non-
   *      personal org.
   *   - `canDelete` — destroy the org. OWNER-only across the product.
   */
  const canEdit = isOwner || isAdmin;
  const canInvite = isOwner && !isPersonal;
  const canLeave = !isOwner && !isPersonal;
  const canDelete = isOwner && !isPersonal;

  const hasActions = canEdit || canDelete || canLeave;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-row items-center gap-4">
          <Avatar className="size-10 shrink-0">
            <AvatarImage src={org.image} alt={org.name} />
            <AvatarFallback>{org.name.charAt(0)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{org.name}</h3>
              <Badge variant="secondary">{isPersonal ? t("badgePersonal") : t("badgeTeam")}</Badge>
              <Badge>{formatRole(org.role)}</Badge>
            </div>

            {isPersonal ? (
              <p className="text-muted-foreground text-xs">{t("personalDescription")}</p>
            ) : (
              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                <MembersModal org={org} />
                {canInvite && <InviteModal org={org} />}
                <span className="text-muted-foreground/60">·</span>
                <span>{t("createdOn", { date: formatDate(org.createdAt) })}</span>
              </div>
            )}
          </div>

          {hasActions && (
            <div className="flex shrink-0 flex-col gap-1">
              {canEdit && <EditOrgModal org={org} />}
              {canDelete && <DeleteOrgDialog org={org} />}
              {canLeave && <LeaveOrgDialog org={org} />}
            </div>
          )}
        </div>

        <ApiKeysSection org={org} />
      </CardContent>
    </Card>
  );
}
