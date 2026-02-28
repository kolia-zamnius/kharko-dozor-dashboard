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
    // `Project` is the unit of API-key authentication in this app — there's
    // no separate "projects" UI, only the api-keys-section inside each org
    // card. The user-facing terminology is therefore "API key", not
    // "project", even though the entity is `Project` in the schema.
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
 * Update the project-wide default display-name trait key.
 *
 * This setting affects the resolved `displayName` of every tracked user in
 * the project, so on success we invalidate the ENTIRE tracked-users detail
 * query scope — each currently-mounted user detail refetches and picks up
 * the new project default. Non-detail queries (activity / sessions / etc.)
 * don't carry `displayName` so they're left alone.
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
      // Broad invalidation across all tracked-user detail queries — any
      // user in this project now has a potentially different resolved
      // `displayName`. TanStack only refetches active observers, so the
      // cost is bounded by what's actually on screen.
      void queryClient.invalidateQueries({ queryKey: trackedUserKeys.details() });
    },
    meta: {
      errorKey: "settings.mutations.projects.updateDisplayNameTrait.error",
      // Dynamic — set vs clear based on the traitKey variable.
      successKey: (variables) => {
        const { traitKey } = variables as { traitKey: string | null };
        return traitKey === null
          ? "settings.mutations.projects.updateDisplayNameTrait.cleared"
          : "settings.mutations.projects.updateDisplayNameTrait.set";
      },
    },
  });
}
