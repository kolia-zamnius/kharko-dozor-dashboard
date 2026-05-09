import { apiFetch } from "@/api-client/_lib/fetch";
import { routes } from "@/api-client/_lib/routes";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { organizationKeys } from "./keys";
import type { Organization, OrganizationInvite, OrganizationMember } from "./schemas";

export const organizationQueries = {
  all: () =>
    queryOptions({
      queryKey: organizationKeys.all(),
      queryFn: ({ signal }) => apiFetch<Organization[]>(routes.organizations.list(), { signal }),
      staleTime: 5 * 60_000,
    }),
  members: (orgId: string) =>
    queryOptions({
      queryKey: organizationKeys.members(orgId),
      queryFn: ({ signal }) => apiFetch<OrganizationMember[]>(routes.organizations.members(orgId), { signal }),
      staleTime: 60_000,
    }),
  /** Short staleTime — invite state is countdown-like, concurrent admin tabs should sync fast. */
  invites: (orgId: string) =>
    queryOptions({
      queryKey: organizationKeys.invites(orgId),
      queryFn: ({ signal }) => apiFetch<OrganizationInvite[]>(routes.organizations.invites(orgId), { signal }),
      staleTime: 30_000,
    }),
};

/** Classic — tolerates `data: undefined`. Used by global layout (mobile drawer, avatar dropdown) that must render before orgs land. */
export function useOrganizationsQuery() {
  return useQuery(organizationQueries.all());
}

/** Suspense twin — must be inside `<Suspense>`. Used by page shells where a single page-level spinner is the desired UX. */
export function useOrganizationsSuspenseQuery() {
  return useSuspenseQuery(organizationQueries.all());
}

/** Gated via `enabled` — modals open on demand. Suspense queries don't accept `enabled: false`, so conditional reads stay classic. */
export function useMembersQuery(orgId: string, enabled = true) {
  return useQuery({ ...organizationQueries.members(orgId), enabled });
}

/** Suspense twin — for shells that always render the data (no `enabled` gate). */
export function useMembersSuspenseQuery(orgId: string) {
  return useSuspenseQuery(organizationQueries.members(orgId));
}

export function useInvitesQuery(orgId: string, enabled = true) {
  return useQuery({ ...organizationQueries.invites(orgId), enabled });
}

/** Suspense twin — for shells that always render the data (no `enabled` gate). */
export function useInvitesSuspenseQuery(orgId: string) {
  return useSuspenseQuery(organizationQueries.invites(orgId));
}
