import { apiFetch } from "@/api-client/fetch";
import { routes } from "@/api-client/routes";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { userKeys } from "./keys";
import type { UserProfile } from "./types";

export const userQueries = {
  profile: () =>
    queryOptions({
      queryKey: userKeys.profile(),
      queryFn: ({ signal }) => apiFetch<UserProfile>(routes.user.me(), { signal }),
      staleTime: 5 * 60_000,
    }),
};

export function useUserProfileQuery() {
  return useSuspenseQuery(userQueries.profile());
}
