import { apiFetch } from "@/api-client/_lib/fetch";
import { routes } from "@/api-client/_lib/routes";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { projectKeys } from "./keys";
import type { Project } from "./schemas";

export const projectQueries = {
  byOrg: (organizationId: string) =>
    queryOptions({
      queryKey: projectKeys.byOrg(organizationId),
      queryFn: ({ signal }) => apiFetch<Project[]>(routes.projects.list({ organizationId }), { signal }),
      staleTime: 60_000,
    }),
};

/** Conditional via `enabled` — modal flows that mount their query only when opened. Suspense doesn't accept `enabled: false`. */
export function useOrgProjectsQuery(organizationId: string, enabled = true) {
  return useQuery({ ...projectQueries.byOrg(organizationId), enabled });
}

/** Suspense twin — for shells that always render the data. Skip when the caller needs `enabled: false`. */
export function useOrgProjectsSuspenseQuery(organizationId: string) {
  return useSuspenseQuery(projectQueries.byOrg(organizationId));
}

/**
 * Plaintext API key on demand — called from the copy-button click handler so the
 * key never lands in TanStack cache. The route is `Cache-Control: no-store`.
 */
export async function fetchProjectKey(projectId: string): Promise<string> {
  const { key } = await apiFetch<{ key: string }>(routes.projects.key(projectId));
  return key;
}
