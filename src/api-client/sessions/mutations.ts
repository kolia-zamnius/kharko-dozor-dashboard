import { apiFetch } from "@/api-client/fetch";
import { routes } from "@/api-client/routes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionKeys } from "./keys";

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(routes.sessions.detail(sessionId), {
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.all() }),
    meta: {
      errorKey: "replays.mutations.deleteSession.error",
      successKey: "replays.mutations.deleteSession.success",
    },
  });
}
