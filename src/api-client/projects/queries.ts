import { apiFetch } from "@/api-client/fetch";
import { routes } from "@/api-client/routes";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { projectKeys } from "./keys";
import type { Project } from "./types";

export const projectQueries = {
  all: () =>
    queryOptions({
      queryKey: projectKeys.all(),
      queryFn: ({ signal }) => apiFetch<Project[]>(routes.projects.list(), { signal }),
      staleTime: 60_000,
    }),
  byOrg: (organizationId: string) =>
    queryOptions({
      queryKey: projectKeys.byOrg(organizationId),
      queryFn: ({ signal }) => apiFetch<Project[]>(routes.projects.list({ organizationId }), { signal }),
      staleTime: 60_000,
    }),
};

export function useProjectsQuery() {
  return useQuery(projectQueries.all());
}

export function useOrgProjectsQuery(organizationId: string, enabled = true) {
  return useQuery({ ...projectQueries.byOrg(organizationId), enabled });
}

/**
 * Plaintext API key on demand — called from the copy-button click handler so the
 * key never lands in TanStack cache. The route is `Cache-Control: no-store`.
 */
export async function fetchProjectKey(projectId: string): Promise<string> {
  const { key } = await apiFetch<{ key: string }>(routes.projects.key(projectId));
  return key;
}
