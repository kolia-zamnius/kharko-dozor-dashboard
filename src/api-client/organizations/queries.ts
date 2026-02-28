import { apiFetch } from "@/api-client/fetch";
import { routes } from "@/api-client/routes";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { organizationKeys } from "./keys";
import type { Organization, OrganizationInvite, OrganizationMember } from "./types";

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
  /**
   * Outstanding PENDING invites for a single organization, admin-side.
   * Short `staleTime` because invite state is countdown-like (expiry,
   * role tweaks, revocations) and the admin modal should reflect edits
   * from a concurrent tab quickly.
   */
  invites: (orgId: string) =>
    queryOptions({
      queryKey: organizationKeys.invites(orgId),
      queryFn: ({ signal }) => apiFetch<OrganizationInvite[]>(routes.organizations.invites(orgId), { signal }),
      staleTime: 30_000,
    }),
};

/**
 * Classic (non-Suspense) — tolerates `data: undefined` during the
 * initial load. Used by global layout components (mobile-drawer,
 * avatar-dropdown) that must render *something* before
 * organisations are available.
 */
export function useOrganizationsQuery() {
  return useQuery(organizationQueries.all());
}

/**
 * Suspense-flavoured twin — consumer must be under `<Suspense>`.
 * Returns `{ data: Organization[] }`, never `undefined`. Used by
 * page shells where a single page-level spinner fallback is the
 * desired UX.
 */
export function useOrganizationsSuspenseQuery() {
  return useSuspenseQuery(organizationQueries.all());
}

/**
 * Gated by `enabled` — called from modals that open on demand.
 * `useSuspenseQuery` does not accept `enabled: false`, so
 * conditional queries stay on classic `useQuery`.
 */
export function useMembersQuery(orgId: string, enabled = true) {
  return useQuery({ ...organizationQueries.members(orgId), enabled });
}

/** Gated — same pattern as `useMembersQuery`. */
export function useInvitesQuery(orgId: string, enabled = true) {
  return useQuery({ ...organizationQueries.invites(orgId), enabled });
}
