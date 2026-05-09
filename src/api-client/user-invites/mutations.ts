import { apiFetch } from "@/api-client/_lib/fetch";
import { organizationQueries } from "@/api-client/organizations/queries";
import { routes } from "@/api-client/_lib/routes";
import { userInviteQueries } from "@/api-client/user-invites/queries";
import type { InviteActionVariables, UserInvite } from "@/api-client/user-invites/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

type OptimisticContext = {
  previous: UserInvite[] | undefined;
};

/**
 * `onMutate` snapshots the list and removes the row synchronously — the table,
 * dot, and badge update before the network round-trip. `onError` restores the
 * snapshot. `onSettled` invalidates once: on success, reconciles edge cases
 * (row also declined in another tab); on error, no-op against the restored snapshot.
 */
async function createOptimisticRemoval(
  queryClient: ReturnType<typeof useQueryClient>,
  inviteId: string,
): Promise<OptimisticContext> {
  const key = userInviteQueries.all().queryKey;
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<UserInvite[]>(key);
  queryClient.setQueryData<UserInvite[]>(key, (old) => (old ? old.filter((invite) => invite.id !== inviteId) : old));
  return { previous };
}

function rollbackOptimisticRemoval(
  queryClient: ReturnType<typeof useQueryClient>,
  context: OptimisticContext | undefined,
) {
  if (context?.previous !== undefined) {
    queryClient.setQueryData(userInviteQueries.all().queryKey, context.previous);
  }
}

/**
 * On success additionally refreshes `organizations` + nudges the session so the
 * new membership shows up in the switcher. `organizationName` rides variables
 * purely so the dynamic `meta.successKey`/`successVars` can render
 * "Joined {organizationName}" without an inline `onSuccess`.
 */
export function useAcceptInviteMutation() {
  const queryClient = useQueryClient();
  const { update } = useSession();

  return useMutation<unknown, Error, InviteActionVariables, OptimisticContext>({
    mutationFn: ({ inviteId }) => apiFetch(routes.user.acceptInvite(inviteId), { method: "POST" }),
    onMutate: ({ inviteId }) => createOptimisticRemoval(queryClient, inviteId),
    onError: (_err, _variables, context) => rollbackOptimisticRemoval(queryClient, context),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueries.all().queryKey });
      void update({});
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: userInviteQueries.all().queryKey });
    },
    meta: {
      errorKey: "settings.mutations.invites.accept.error",
      successKey: "settings.mutations.invites.accept.success",
      successVars: (variables) => {
        const { organizationName } = variables as InviteActionVariables;
        return { organizationName };
      },
    },
  });
}

/** Same optimistic pattern as accept, but no organizations refresh and no session nudge — just the invites cache. */
export function useDeclineInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, InviteActionVariables, OptimisticContext>({
    mutationFn: ({ inviteId }) => apiFetch(routes.user.declineInvite(inviteId), { method: "POST" }),
    onMutate: ({ inviteId }) => createOptimisticRemoval(queryClient, inviteId),
    onError: (_err, _variables, context) => rollbackOptimisticRemoval(queryClient, context),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: userInviteQueries.all().queryKey });
    },
    meta: {
      errorKey: "settings.mutations.invites.decline.error",
      successKey: "settings.mutations.invites.decline.success",
      successVars: (variables) => {
        const { organizationName } = variables as InviteActionVariables;
        return { organizationName };
      },
    },
  });
}
