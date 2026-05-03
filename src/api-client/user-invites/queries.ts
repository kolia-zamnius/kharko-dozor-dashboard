import { apiFetch } from "@/api-client/fetch";
import { routes } from "@/api-client/routes";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { userInviteKeys } from "./keys";
import type { UserInvite } from "./types";

/**
 * Short `staleTime` (30s) — pending invites are countdown-like and the navbar
 * badge should refresh on focus rather than wait out a long window.
 */
export const userInviteQueries = {
  all: () =>
    queryOptions({
      queryKey: userInviteKeys.all(),
      queryFn: ({ signal }) => apiFetch<UserInvite[]>(routes.user.invites(), { signal }),
      staleTime: 30_000,
    }),
};

/** Classic — avatar dropdown + mobile drawer render the badge before invites land. */
export function useUserInvitesQuery() {
  return useQuery(userInviteQueries.all());
}

/** Suspense twin — used by `organizations-settings.tsx` page shell where pending invites are core content, not a badge. */
export function useUserInvitesSuspenseQuery() {
  return useSuspenseQuery(userInviteQueries.all());
}
