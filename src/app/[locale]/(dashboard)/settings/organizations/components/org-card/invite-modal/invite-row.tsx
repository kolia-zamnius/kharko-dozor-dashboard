import { Button } from "@/components/ui/primitives/button";
import { TableCell, TableRow } from "@/components/ui/data-display/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/forms/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/overlays/tooltip";
import { useDeleteInviteMutation, useUpdateInviteMutation } from "@/api-client/organizations/mutations";
import type { OrganizationInvite } from "@/api-client/organizations/types";
import { useFormatters } from "@/lib/use-formatters";
import { ArrowClockwiseIcon, TrashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { INVITE_ROLE_OPTIONS } from "../../role-options";

/**
 * Revoke is one-click — trivially reversible (just re-invite the email above)
 * and modal-in-modal has worse ergonomics than a misclick recovery cost.
 * Per-row mutations so `isPending` doesn't bleed across rows.
 */
export function InviteRow({ orgId, invite }: { orgId: string; invite: OrganizationInvite }) {
  const t = useTranslations("settings.orgs.invite.pending");
  const tRoles = useTranslations("settings.orgs.roles");
  const { formatDate, formatRelative } = useFormatters();
  const updateInvite = useUpdateInviteMutation();
  const deleteInvite = useDeleteInviteMutation();

  function handleRoleChange(value: string) {
    if (value === invite.role) return;
    updateInvite.mutate({
      orgId,
      inviteId: invite.id,
      email: invite.email,
      action: "change-role",
      role: value as OrganizationInvite["role"],
    });
  }

  function handleExtend() {
    updateInvite.mutate({
      orgId,
      inviteId: invite.id,
      email: invite.email,
      action: "extend",
    });
  }

  function handleRevoke() {
    deleteInvite.mutate({ orgId, inviteId: invite.id, email: invite.email });
  }

  const invitedByLabel = invite.invitedBy.name ?? invite.invitedBy.email;

  return (
    <TableRow>
      <TableCell className="font-medium">{invite.email}</TableCell>
      <TableCell>
        <Select value={invite.role} onValueChange={handleRoleChange} disabled={updateInvite.isPending}>
          <SelectTrigger aria-label={t("roleAria", { email: invite.email })} className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITE_ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {tRoles(`${opt.key}.label`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      {/*
       * Relative time reads fast ("in 2 days") but the absolute date
       * is the unambiguous source of truth — put it in a tooltip so
       * admins can still confirm the exact expiry without another click.
       * Row-scoped `TooltipProvider` matches the `session-row.tsx` pattern
       * (no app-wide provider in `providers.tsx` today).
       */}
      <TableCell className="text-muted-foreground">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default">
                {t("expiresRelative", { relative: formatRelative(invite.expiresAt) })}
              </span>
            </TooltipTrigger>
            <TooltipContent>{formatDate(invite.expiresAt)}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="text-muted-foreground">{invitedByLabel}</TableCell>
      <TableCell className="text-right">
        {/*
         * Both action buttons share a single `TooltipProvider` — cheaper
         * than one wrapper per tooltip and visually identical. Each
         * button's own mutation owns its `isPending` state, so Extend
         * and Revoke disable independently without blocking each other.
         */}
        <TooltipProvider>
          <div className="flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("extendAria", { email: invite.email })}
                  onClick={handleExtend}
                  disabled={updateInvite.isPending}
                >
                  <ArrowClockwiseIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("extendTooltip")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("revokeAria", { email: invite.email })}
                  onClick={handleRevoke}
                  disabled={deleteInvite.isPending}
                  className="text-destructive"
                >
                  <TrashIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("revokeTooltip")}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );
}
