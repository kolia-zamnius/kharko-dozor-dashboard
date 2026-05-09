import { apiFetch } from "@/api-client/_lib/fetch";
import { organizationKeys } from "@/api-client/organizations/keys";
import { organizationQueries } from "@/api-client/organizations/queries";
import { projectKeys } from "@/api-client/projects/keys";
import { routes } from "@/api-client/_lib/routes";
import { sessionKeys } from "@/api-client/sessions/keys";
import { trackedUserKeys } from "@/api-client/tracked-users/keys";
import type {
  CreateOrgInput,
  InviteInput,
  Organization,
  OrganizationInvite,
  OrganizationMember,
  UpdateInviteInput,
  UpdateOrgInput,
} from "@/api-client/organizations/schemas";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TranslationValues } from "next-intl";
import { useSession } from "next-auth/react";

type Role = Organization["role"];
type InviteRole = OrganizationInvite["role"];

/**
 * Invalidates every org-scoped TanStack cache so the user doesn't keep seeing the
 * previous org's data after the switch. RSC pages that prefetched on the server
 * bypass TanStack — `router.refresh()` is the only way to nudge them.
 */
export function useSwitchOrgMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { update } = useSession();

  return useMutation({
    mutationFn: (orgId: string) =>
      apiFetch(routes.organizations.active(), {
        method: "PATCH",
        body: JSON.stringify({ organizationId: orgId }),
      }),
    onSuccess: async () => {
      await update({});
      void queryClient.invalidateQueries({ queryKey: trackedUserKeys.all() });
      void queryClient.invalidateQueries({ queryKey: sessionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all() });
      router.refresh();
    },
    meta: { errorKey: "settings.mutations.orgs.switch.error" },
  });
}

export function useCreateOrgMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrgInput) =>
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
    mutationFn: ({ orgId, ...data }: { orgId: string } & UpdateOrgInput) =>
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
      // Dual-purpose mutation — `successKey` picks copy for avatar regen vs rename.
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

/**
 * POST is idempotent — bumps `expiresAt` on an existing PENDING invite for the
 * same email, or creates a new one. Resending = clicking Invite again.
 */
export function useInviteMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, email, role }: { orgId: string } & InviteInput) =>
      apiFetch(routes.organizations.invites(orgId), {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: (_, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.invites(orgId).queryKey });
    },
    meta: {
      errorKey: "settings.mutations.orgs.invite.error",
      successKey: "settings.mutations.orgs.invite.success",
      successVars: (variables) => {
        const { email } = variables as { email: string };
        return { email };
      },
    },
  });
}

type InvitesOptimisticContext = {
  previous: OrganizationInvite[] | undefined;
};

/**
 * Optimistic role / `expiresAt` update; rollback on server failure, refetch on
 * settle for the authoritative timestamp. Extend writes a 1-minute-future
 * `expiresAt` placeholder to flip "expiring soon" styling immediately.
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
      // Different copy for role-change vs extend.
      successKey: (variables) => {
        const v = variables as { email: string } & UpdateInviteInput;
        return v.action === "change-role"
          ? "settings.mutations.orgs.updateInvite.roleChanged"
          : "settings.mutations.orgs.updateInvite.extended";
      },
      // Role passed as ICU var — message uses `{role, select, ...}` for the localised label.
      // Explicit return type flattens the union to `TranslationValues`'s index-signature shape.
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
 * Optimistic removal + rollback. `email` is toast-only metadata — flows to
 * `meta.successVars` so call sites don't need an inline `onSuccess`.
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

export type { InviteRole };

type MembersOptimisticContext = {
  previous: OrganizationMember[] | undefined;
};

/**
 * Optimistic role flip — pill + dropdown change before the server round-trip.
 * Stable `mutationKey` so siblings can observe in-flight via
 * `useIsMutating({ mutationKey })` and disable concurrent edits org-wide.
 */
export function useUpdateMemberRoleMutation(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { orgId: string; memberId: string; role: Role }, MembersOptimisticContext>({
    mutationKey: organizationKeys.memberRoleMutation(orgId),
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
      successKey: "settings.mutations.orgs.updateRole.success",
      // Role passed as ICU var — message uses `{role, select, ...}` for the localised label.
      successVars: (variables) => {
        const { role } = variables as { role: Role };
        return { role };
      },
    },
  });
}

/**
 * Optimistic remove. Self-leave path also nudges the session — membership set
 * and possibly `activeOrganizationId` need a refresh.
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
    // `isSelf` + `orgName` are toast-only metadata — flow to dynamic `successKey`
    // / `successVars` to distinguish "you left" from "you removed someone".
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
      // Three distinct keys (vs ICU select on a synthetic var) — each branch is a
      // full sentence, easier for translators than per-word interpolation.
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
