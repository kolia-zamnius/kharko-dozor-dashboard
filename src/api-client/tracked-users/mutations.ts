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
 * Three-state field semantics: omitted = leave alone, `null` = reset, string =
 * set. Only explicit fields reach the API — omitted ones aren't serialized, so
 * the server's partial update logic leaves them in the DB untouched. Five
 * distinct success keys (which field × set vs clear) — clearer than one ICU
 * select when each path is a fixed sentence.
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
