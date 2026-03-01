import { apiFetch } from "@/api-client/fetch";
import { routes } from "@/api-client/routes";
import { trackedUserQueries } from "@/api-client/tracked-users/queries";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type UpdateDisplayNameVars = {
  userId: string;
  /** `undefined` = leave unchanged, `null` = reset, string = set. */
  customName?: string | null;
  /** `undefined` = leave unchanged, `null` = reset, string = set. */
  traitKey?: string | null;
};

/**
 * Update the display-name override fields on a tracked user.
 *
 * Only fields explicitly present on the input reach the API — omitted
 * fields aren't serialized into the JSON body, so the server's partial
 * update logic leaves them untouched in the DB.
 *
 * On success, invalidates the specific user's detail query so the header's
 * resolved `displayName` and the modal's pre-filled inputs pick up the new
 * state without a full page reload.
 *
 * Success message is computed from the variables: "saved" vs "cleared",
 * and which field was touched. The global `MutationCache.onSuccess` handler
 * in `query-client.ts` calls this function and shows the result via toast.
 */
export function useUpdateTrackedUserDisplayNameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, customName, traitKey }: UpdateDisplayNameVars) => {
      const payload: { customName?: string | null; traitKey?: string | null } = {};
      if (customName !== undefined) payload.customName = customName;
      if (traitKey !== undefined) payload.traitKey = traitKey;

      await apiFetch<void>(routes.trackedUsers.displayName(userId), {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({
        queryKey: trackedUserQueries.detail(userId).queryKey,
      });
    },
    meta: {
      errorKey: "users.mutations.updateDisplayName.error",
      // Dynamic key: which field was touched + set vs clear. Phase-3 port
      // kept the branching shape — 5 distinct keys is clearer than one
      // ICU-select message when each path is a fixed sentence.
      successKey: (variables) => {
        const { customName, traitKey } = variables as UpdateDisplayNameVars;
        if (customName !== undefined) {
          return customName === null
            ? "users.mutations.updateDisplayName.customNameCleared"
            : "users.mutations.updateDisplayName.customNameSet";
        }
        if (traitKey !== undefined) {
          return traitKey === null
            ? "users.mutations.updateDisplayName.traitKeyCleared"
            : "users.mutations.updateDisplayName.traitKeySet";
        }
        return "users.mutations.updateDisplayName.generic";
      },
    },
  });
}
