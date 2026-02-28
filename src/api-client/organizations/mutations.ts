import { apiFetch } from "@/api-client/fetch";
import { organizationQueries } from "@/api-client/organizations/queries";
import { routes } from "@/api-client/routes";
import type { Organization, OrganizationInvite, OrganizationMember } from "@/api-client/organizations/types";
import type { UpdateInviteInput } from "@/api-client/organizations/validators";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TranslationValues } from "next-intl";
import { useSession } from "next-auth/react";

type Role = Organization["role"];
type InviteRole = OrganizationInvite["role"];

export function useSwitchOrgMutation() {
  const { update } = useSession();

  return useMutation({
    mutationFn: (orgId: string) =>
      apiFetch(routes.organizations.active(), {
        method: "PATCH",
        body: JSON.stringify({ organizationId: orgId }),
      }),
    onSuccess: () => update({}),
    meta: { errorKey: "settings.mutations.orgs.switch.error" },
  });
}

export function useCreateOrgMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string }) =>
      apiFetch(routes.organizations.list(), {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationQueries.all().queryKey }),
    meta: {
      errorKey: "settings.mutations.orgs.create.error",
      successKey: "settings.mutations.orgs.create.success",
    },
  });
}

export function useUpdateOrgMutation() {
  const queryClient = useQueryClient();
  const { update } = useSession();

  return useMutation({
    mutationFn: ({ orgId, ...data }: { orgId: string; name?: string; regenerateAvatar?: boolean }) =>
      apiFetch(routes.organizations.detail(orgId), {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.all().queryKey });
      void update({});
    },
    meta: {
      errorKey: "settings.mutations.orgs.update.error",
      // Dual-purpose mutation — distinct key for each operation.
      successKey: (variables) => {
        const { regenerateAvatar } = variables as { regenerateAvatar?: boolean };
        return regenerateAvatar
          ? "settings.mutations.orgs.update.avatarRegenerated"
          : "settings.mutations.orgs.update.renamed";
      },
    },
  });
}

export function useDeleteOrgMutation() {
  const queryClient = useQueryClient();
  const { update } = useSession();

  return useMutation({
    mutationFn: (orgId: string) =>
      apiFetch(routes.organizations.detail(orgId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.all().queryKey });
      void update({});
    },
    meta: {
      errorKey: "settings.mutations.orgs.delete.error",
      successKey: "settings.mutations.orgs.delete.success",
    },
  });
}

export function useInviteMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, email, role }: { orgId: string; email: string; role: Role }) =>
      apiFetch(routes.organizations.invites(orgId), {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    // Invalidate the admin-side invites table so a freshly-sent invite
    // (or a refreshed one — POST is idempotent and bumps expiresAt) shows
    // up immediately alongside any pre-existing pending rows.
    onSuccess: (_, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.invites(orgId).queryKey });
    },
    meta: {
      errorKey: "settings.mutations.orgs.invite.error",
      successKey: "settings.mutations.orgs.invite.success",
      // Email is part of variables, so the toast can name the recipient.
      successVars: (variables) => {
        const { email } = variables as { email: string };
        return { email };
      },
    },
  });
}

/**
 * Context shared by the invite PATCH/DELETE optimistic helpers. Same shape
 * as the user-invites rollback context — snapshot the full list, restore
 * it on failure.
 */
type InvitesOptimisticContext = {
  previous: OrganizationInvite[] | undefined;
};

/**
 * Admin edits a pending invite in place — either promoting / demoting a
 * role, or bumping `expiresAt` back to a fresh `INVITE_EXPIRY_DAYS`
 * window. Optimistic: the table row's role dropdown / "expires in N days"
 * text updates the moment the click lands; on server failure we roll
 * back the cache atomically.
 *
 * Extend writes a cache-side placeholder `expiresAt` one minute in the
 * future to flip the "Expired today" style immediately. The server
 * response is authoritative — `onSettled` re-fetches to reconcile the
 * real timestamp.
 */
export function useUpdateInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    { orgId: string; inviteId: string; email: string } & UpdateInviteInput,
    InvitesOptimisticContext
  >({
    mutationFn: ({ orgId, inviteId, ...body }) =>
      apiFetch(routes.organizations.invite(orgId, inviteId), {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onMutate: async ({ orgId, inviteId, ...body }) => {
      const key = organizationQueries.invites(orgId).queryKey;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<OrganizationInvite[]>(key);

      queryClient.setQueryData<OrganizationInvite[]>(key, (old) => {
        if (!old) return old;
        return old.map((invite) => {
          if (invite.id !== inviteId) return invite;
          if (body.action === "change-role") {
            return { ...invite, role: body.role };
          }
          // Optimistic placeholder — pushes expiresAt forward far enough
          // to unstick any "expiring soon" styling. Reconciled on refetch.
          const placeholder = new Date(Date.now() + 60_000).toISOString();
          return { ...invite, expiresAt: placeholder };
        });
      });

      return { previous };
    },
    onError: (_err, variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(organizationQueries.invites(variables.orgId).queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.invites(orgId).queryKey });
    },
    meta: {
      errorKey: "settings.mutations.orgs.updateInvite.error",
      // Dynamic key — different sentence for role-change vs extend.
      successKey: (variables) => {
        const v = variables as { email: string } & UpdateInviteInput;
        return v.action === "change-role"
          ? "settings.mutations.orgs.updateInvite.roleChanged"
          : "settings.mutations.orgs.updateInvite.extended";
      },
      // Role is passed through so the ICU `{role, select, ...}` format in
      // the message can render a locale-aware label without another lookup.
      // Explicit return type flattens the union to the index-signature
      // shape that `TranslationValues` requires.
      successVars: (variables): TranslationValues => {
        const v = variables as { email: string } & UpdateInviteInput;
        if (v.action === "change-role") {
          return { email: v.email, role: v.role };
        }
        return { email: v.email };
      },
    },
  });
}

/**
 * Revoke a pending invite. Optimistic removal from the admin-side table.
 * Same rollback shape as accept/decline on the user-side: snapshot,
 * filter, restore on error.
 *
 * `email` is variables-only metadata for the toast — it doesn't affect
 * the API call, but lets `meta.successVars` render "Revoked invite
 * for foo@bar.com" without the call site needing an inline onSuccess.
 */
export function useDeleteInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { orgId: string; inviteId: string; email: string }, InvitesOptimisticContext>({
    mutationFn: ({ orgId, inviteId }) => apiFetch(routes.organizations.invite(orgId, inviteId), { method: "DELETE" }),
    onMutate: async ({ orgId, inviteId }) => {
      const key = organizationQueries.invites(orgId).queryKey;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<OrganizationInvite[]>(key);

      queryClient.setQueryData<OrganizationInvite[]>(key, (old) =>
        old ? old.filter((invite) => invite.id !== inviteId) : old,
      );

      return { previous };
    },
    onError: (_err, { orgId }, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(organizationQueries.invites(orgId).queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.invites(orgId).queryKey });
    },
    meta: {
      errorKey: "settings.mutations.orgs.deleteInvite.error",
      successKey: "settings.mutations.orgs.deleteInvite.success",
      successVars: (variables) => {
        const { email } = variables as { email: string };
        return { email };
      },
    },
  });
}

// `InviteRole` is re-exported for call-sites that want to type a role
// handler without reaching into the OrganizationInvite type directly.
export type { InviteRole };

/**
 * Rollback context for the members-list optimistic mutations — full
 * snapshot of the cached list, restored on error. Same shape as the
 * invites optimistic context above; kept as a separate type rather
 * than merged because the two caches hold different entity shapes.
 */
type MembersOptimisticContext = {
  previous: OrganizationMember[] | undefined;
};

/**
 * Change a member's role. Optimistic: the role pill and dropdown flip
 * the moment the OWNER picks a new value — no 200-500 ms wait for the
 * server round-trip before the UI agrees. Rollback via snapshot on
 * failure, invalidate on settle to pick up the authoritative shape.
 */
export function useUpdateMemberRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { orgId: string; memberId: string; role: Role }, MembersOptimisticContext>({
    mutationFn: ({ orgId, memberId, role }) =>
      apiFetch(routes.organizations.member(orgId, memberId), {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onMutate: async ({ orgId, memberId, role }) => {
      const key = organizationQueries.members(orgId).queryKey;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<OrganizationMember[]>(key);

      queryClient.setQueryData<OrganizationMember[]>(key, (old) =>
        old ? old.map((m) => (m.id === memberId ? { ...m, role } : m)) : old,
      );

      return { previous };
    },
    onError: (_err, { orgId }, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(organizationQueries.members(orgId).queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.members(orgId).queryKey });
      void queryClient.invalidateQueries({ queryKey: organizationQueries.all().queryKey });
    },
    meta: {
      errorKey: "settings.mutations.orgs.updateRole.error",
      // Role is pushed through as a variable so the ICU `{role, select, ...}`
      // format in the message can render the localised label without
      // another lookup at the toast site.
      successKey: "settings.mutations.orgs.updateRole.success",
      successVars: (variables) => {
        const { role } = variables as { role: Role };
        return { role };
      },
    },
  });
}

/**
 * Remove a member (or self-leave). Optimistic: the row disappears
 * from the members list immediately. Rollback on failure; on success
 * we additionally invalidate the orgs list + nudge the session (for
 * the self-leave flow, where the user's membership set and possibly
 * `activeOrganizationId` need a refresh).
 */
export function useRemoveMemberMutation() {
  const queryClient = useQueryClient();
  const { update } = useSession();

  return useMutation<
    unknown,
    Error,
    { orgId: string; memberId: string; isSelf?: boolean; orgName?: string },
    MembersOptimisticContext
  >({
    // `isSelf` and `orgName` are metadata for the toast only — they don't
    // affect the API call itself. Carrying them through variables lets the
    // dynamic successKey distinguish "you left" from "you removed
    // someone" AND name the org you left, all without the call site
    // needing an inline `onSuccess` toast.
    mutationFn: ({ orgId, memberId }) =>
      apiFetch(routes.organizations.member(orgId, memberId), {
        method: "DELETE",
      }),
    onMutate: async ({ orgId, memberId }) => {
      const key = organizationQueries.members(orgId).queryKey;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<OrganizationMember[]>(key);

      queryClient.setQueryData<OrganizationMember[]>(key, (old) => (old ? old.filter((m) => m.id !== memberId) : old));

      return { previous };
    },
    onError: (_err, { orgId }, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(organizationQueries.members(orgId).queryKey, context.previous);
      }
    },
    onSuccess: () => {
      void update({});
    },
    onSettled: (_data, _err, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.members(orgId).queryKey });
      void queryClient.invalidateQueries({ queryKey: organizationQueries.all().queryKey });
    },
    meta: {
      errorKey: "settings.mutations.orgs.removeMember.error",
      // Three distinct keys — cleaner for Phase-4 translators than an ICU
      // select over a synthetic context variable, since each branch is a
      // full sentence rather than a single word.
      successKey: (variables) => {
        const { isSelf, orgName } = variables as { isSelf?: boolean; orgName?: string };
        if (isSelf) {
          return orgName
            ? "settings.mutations.orgs.removeMember.selfLeftNamed"
            : "settings.mutations.orgs.removeMember.selfLeftGeneric";
        }
        return "settings.mutations.orgs.removeMember.removed";
      },
      successVars: (variables): TranslationValues => {
        const { orgName } = variables as { orgName?: string };
        return orgName ? { orgName } : {};
      },
    },
  });
}
