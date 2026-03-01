import { apiFetch } from "@/api-client/fetch";
import { organizationQueries } from "@/api-client/organizations/queries";
import { routes } from "@/api-client/routes";
import { userInviteQueries } from "@/api-client/user-invites/queries";
import type { UserInvite } from "@/api-client/user-invites/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

type InviteVariables = { inviteId: string; organizationName: string };

/**
 * Context object returned from `onMutate` and consumed by `onError` for
 * optimistic rollback. Holds the full list of invites as it looked
 * before we optimistically removed the accepted/declined row, so we
 * can restore it atomically if the mutation fails.
 */
type OptimisticContext = {
  previous: UserInvite[] | undefined;
};

/**
 * Shared helper that wires the optimistic-update dance for both the
 * accept and decline flows. They differ only in their HTTP call and
 * their post-success side effects; the cache juggling is identical:
 *
 *   1. `onMutate` cancels any in-flight refetch of the invites query
 *      (so it can't race-win against our optimistic write), snapshots
 *      the current list, then removes the target row from the cache
 *      synchronously. The table / dot / badge all re-render immediately
 *      with the row gone — no wait for the network round-trip.
 *   2. `onError` restores the snapshot, so a server failure rolls back
 *      as if nothing happened. The global `MutationCache` still fires
 *      the error toast from `meta.errorKey` (or the specific
 *      `ApiError.message` — see the mutation-cache wiring in
 *      `lib/query-client.ts`).
 *   3. `onSettled` invalidates the query once, unconditionally. On
 *      success this reconciles with whatever shape the server settled
 *      on (handles the edge case where server and optimistic state
 *      diverge — e.g. the row was also declined in another tab). On
 *      error it's a no-op against the already-restored snapshot.
 *
 * Keeping this helper local to the file (vs exporting a utility) is
 * deliberate: the two call sites are the only consumers, the shape is
 * narrow, and pulling it out would obscure what each mutation actually
 * does when read end-to-end.
 */
function createOptimisticRemoval(
  queryClient: ReturnType<typeof useQueryClient>,
  inviteId: string,
): Promise<OptimisticContext> {
  const key = userInviteQueries.all().queryKey;
  return queryClient.cancelQueries({ queryKey: key }).then(() => {
    const previous = queryClient.getQueryData<UserInvite[]>(key);
    queryClient.setQueryData<UserInvite[]>(key, (old) => (old ? old.filter((invite) => invite.id !== inviteId) : old));
    return { previous };
  });
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
 * Accept a pending invite.
 *
 * Optimistic: the row is removed from the `user.invites` cache the
 * instant the user clicks "Join" — the dialog closes, the
 * `PendingInvitesSection` table updates, and the navbar dot count
 * recalculates, all before the network request finishes. On success
 * we additionally refresh `organizations` + nudge the session so the
 * new membership shows up in the switcher.
 *
 * `organizationName` is carried in variables purely so that the
 * dynamic `meta.successKey` + `successVars` (resolved in the global `MutationCache`)
 * can render `"Joined ${name}"` without the call site wiring its own
 * toast.
 */
export function useAcceptInviteMutation() {
  const queryClient = useQueryClient();
  const { update } = useSession();

  return useMutation<unknown, Error, InviteVariables, OptimisticContext>({
    mutationFn: ({ inviteId }) => apiFetch(routes.user.acceptInvite(inviteId), { method: "POST" }),
    onMutate: ({ inviteId }) => createOptimisticRemoval(queryClient, inviteId),
    onError: (_err, _variables, context) => rollbackOptimisticRemoval(queryClient, context),
    onSuccess: () => {
      // The invites query reconciles in `onSettled`. Here we only
      // invalidate side-effect queries that weren't part of the
      // optimistic write.
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
        const { organizationName } = variables as InviteVariables;
        return { organizationName };
      },
    },
  });
}

/**
 * Decline a pending invite.
 *
 * Same optimistic pattern as accept, but a narrower set of side
 * effects on success — only the invites query needs reconciling, the
 * organizations list is untouched, no session update.
 */
export function useDeclineInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, InviteVariables, OptimisticContext>({
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
        const { organizationName } = variables as InviteVariables;
        return { organizationName };
      },
    },
  });
}
