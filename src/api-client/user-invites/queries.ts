import { apiFetch } from "@/api-client/fetch";
import { routes } from "@/api-client/routes";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { userInviteKeys } from "./keys";
import type { UserInvite } from "./types";

/**
 * Query options factory for the signed-in user's pending invites.
 *
 * Why `queryOptions()` and not a plain `useQuery` hook? Two reasons:
 *   1. The same options object needs to be passed to
 *      `queryClient.invalidateQueries({ queryKey: ... })` from mutations,
 *      so centralizing the key shape here avoids typo drift.
 *   2. Server Components can `prefetchQuery(userInviteQueries.all())` in
 *      the future without needing to duplicate the queryFn.
 *
 * `staleTime` is short (30s) because pending invites are a count-down
 * experience: the user expects a newly declined invite to disappear from
 * the list immediately, and the badge indicator in the navbar should
 * refresh on focus rather than wait for a 5-minute window.
 */
export const userInviteQueries = {
  all: () =>
    queryOptions({
      queryKey: userInviteKeys.all(),
      queryFn: ({ signal }) => apiFetch<UserInvite[]>(routes.user.invites(), { signal }),
      staleTime: 30_000,
    }),
};

/**
 * Classic (non-Suspense) — the avatar-dropdown and mobile-drawer
 * render a badge count before invites have loaded, so they need the
 * `data: undefined` tolerance of `useQuery`.
 */
export function useUserInvitesQuery() {
  return useQuery(userInviteQueries.all());
}

/**
 * Suspense-flavoured twin — consumer must be under `<Suspense>`.
 * Returns `{ data: UserInvite[] }`, never `undefined`. Used by
 * `organizations-settings.tsx` page shell where pending invites are
 * part of the core content, not a badge.
 */
export function useUserInvitesSuspenseQuery() {
  return useSuspenseQuery(userInviteQueries.all());
}
