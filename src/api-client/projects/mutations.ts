import { apiFetch } from "@/api-client/fetch";
import { projectQueries } from "@/api-client/projects/queries";
import { routes } from "@/api-client/routes";
import type { Project } from "@/api-client/projects/types";
import { trackedUserKeys } from "@/api-client/tracked-users/keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, organizationId }: { name: string; organizationId: string }) =>
      apiFetch<Project>(routes.projects.list(), {
        method: "POST",
        body: JSON.stringify({ name, organizationId }),
      }),
    onSuccess: (_, { organizationId }) => {
      void queryClient.invalidateQueries({ queryKey: projectQueries.all().queryKey });
      void queryClient.invalidateQueries({ queryKey: projectQueries.byOrg(organizationId).queryKey });
    },
    // User-facing copy says "API key" — `Project` is the schema-level entity.
    // The api-keys section of each org card IS the project UI; there's no separate "projects" page.
    meta: {
      errorKey: "settings.mutations.projects.create.error",
      successKey: "settings.mutations.projects.create.success",
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      apiFetch(routes.projects.detail(projectId), {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectQueries.all().queryKey }),
    meta: {
      errorKey: "settings.mutations.projects.update.error",
      successKey: "settings.mutations.projects.update.success",
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch(routes.projects.detail(projectId), {
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectQueries.all().queryKey }),
    meta: {
      errorKey: "settings.mutations.projects.delete.error",
      successKey: "settings.mutations.projects.delete.success",
    },
  });
}

export function useRegenerateProjectKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch<Project>(routes.projects.regenerateKey(projectId), {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectQueries.all().queryKey }),
    meta: {
      errorKey: "settings.mutations.projects.regenerateKey.error",
      successKey: "settings.mutations.projects.regenerateKey.success",
    },
  });
}

/**
 * Updating the project default cascades to every tracked user's resolved
 * `displayName`. Invalidates the entire detail-query scope; TanStack only refetches
 * active observers, so the cost is bounded by what's on screen.
 */
export function useUpdateProjectDisplayNameTraitKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, traitKey }: { projectId: string; traitKey: string | null }) => {
      await apiFetch<void>(routes.projects.displayNameTraitKey(projectId), {
        method: "PATCH",
        body: JSON.stringify({ traitKey }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trackedUserKeys.details() });
    },
    meta: {
      errorKey: "settings.mutations.projects.updateDisplayNameTrait.error",
      // Different copy for set vs clear.
      successKey: (variables) => {
        const { traitKey } = variables as { traitKey: string | null };
        return traitKey === null
          ? "settings.mutations.projects.updateDisplayNameTrait.cleared"
          : "settings.mutations.projects.updateDisplayNameTrait.set";
      },
    },
  });
}
