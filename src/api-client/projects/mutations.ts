import { apiFetch } from "@/api-client/_lib/fetch";
import { projectKeys } from "@/api-client/projects/keys";
import { routes } from "@/api-client/_lib/routes";
import type {
  CreateProjectInput,
  Project,
  UpdateProjectDisplayNameTraitKeyInput,
  UpdateProjectInput,
} from "@/api-client/projects/schemas";
import { trackedUserKeys } from "@/api-client/tracked-users/keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, organizationId }: CreateProjectInput) =>
      apiFetch<Project>(routes.projects.list(), {
        method: "POST",
        body: JSON.stringify({ name, organizationId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
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
    mutationFn: ({ projectId, name }: { projectId: string } & UpdateProjectInput) =>
      apiFetch(routes.projects.detail(projectId), {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all() }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all() }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all() }),
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
    mutationFn: ({ projectId, traitKey }: { projectId: string } & UpdateProjectDisplayNameTraitKeyInput) =>
      apiFetch<void>(routes.projects.displayNameTraitKey(projectId), {
        method: "PATCH",
        body: JSON.stringify({ traitKey }),
      }),
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
