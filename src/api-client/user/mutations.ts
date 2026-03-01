import { apiFetch } from "@/api-client/fetch";
import { routes } from "@/api-client/routes";
import { userQueries } from "@/api-client/user/queries";
import type { UpdateLocaleInput } from "@/api-client/user/validators";
import { signalUnknownCredential } from "@/lib/signal-unknown-credential";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signIn } from "next-auth/webauthn";
import { useSession } from "next-auth/react";

function useProfileInvalidation() {
  const queryClient = useQueryClient();
  const { update } = useSession();

  return () => Promise.all([update({}), queryClient.invalidateQueries({ queryKey: userQueries.profile().queryKey })]);
}

export function useUpdateProfileMutation() {
  const invalidate = useProfileInvalidation();

  return useMutation({
    mutationFn: (data: { name: string }) =>
      apiFetch(routes.user.me(), {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => void invalidate(),
    meta: {
      errorKey: "settings.mutations.user.updateProfile.error",
      successKey: "settings.mutations.user.updateProfile.success",
    },
  });
}

export function useRegenerateAvatarMutation() {
  const invalidate = useProfileInvalidation();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ image: string }>(routes.user.avatar(), {
        method: "POST",
      }),
    onSuccess: () => void invalidate(),
    meta: {
      errorKey: "settings.mutations.user.regenerateAvatar.error",
      successKey: "settings.mutations.user.regenerateAvatar.success",
    },
  });
}

export function useRegisterPasskeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => signIn("passkey", { action: "register", redirect: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userQueries.profile().queryKey }),
    meta: {
      errorKey: "settings.mutations.user.registerPasskey.error",
      successKey: "settings.mutations.user.registerPasskey.success",
    },
  });
}

export function useRenamePasskeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ credentialID, name }: { credentialID: string; name: string }) =>
      apiFetch(routes.user.passkey(encodeURIComponent(credentialID)), {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userQueries.profile().queryKey }),
    meta: {
      errorKey: "settings.mutations.user.renamePasskey.error",
      successKey: "settings.mutations.user.renamePasskey.success",
    },
  });
}

export function useDeletePasskeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentialID: string) =>
      apiFetch(routes.user.passkey(encodeURIComponent(credentialID)), {
        method: "DELETE",
      }),
    onSuccess: (_, credentialID) => {
      void queryClient.invalidateQueries({ queryKey: userQueries.profile().queryKey });

      // Tell the browser / OS this credential is gone (Chrome 132+).
      // Feature-detected + error-swallowing inside the wrapper so
      // pre-132 browsers and any unexpected rejection both no-op.
      void signalUnknownCredential({ rpId: window.location.hostname, credentialId: credentialID });
    },
    meta: {
      errorKey: "settings.mutations.user.deletePasskey.error",
      successKey: "settings.mutations.user.deletePasskey.success",
    },
  });
}

export function useDisconnectAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (provider: string) =>
      apiFetch(routes.user.account(encodeURIComponent(provider)), {
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userQueries.profile().queryKey }),
    meta: {
      errorKey: "settings.mutations.user.disconnectAccount.error",
      successKey: "settings.mutations.user.disconnectAccount.success",
    },
  });
}

/**
 * Persist a locale preference change on `User.locale`.
 *
 * @remarks
 * Does NOT do the session refresh + router.replace dance itself — the
 * caller composes those in `onSuccess` because the exact behaviour is
 * UI-specific (e.g. `<LocaleSection>` re-navigates to the same pathname
 * with the new locale prefix so the whole tree re-renders under the new
 * language). The mutation stays focused on the single server write + the
 * toast; the composition lives one layer up where the router + session
 * handles are already in scope.
 *
 * @see src/app/api/user/locale/route.ts — PATCH endpoint.
 * @see src/app/[locale]/(dashboard)/settings/user/components/locale-section.tsx —
 *   primary consumer wiring the session / router refresh chain.
 */
export function useUpdateLocaleMutation() {
  return useMutation({
    mutationFn: (data: UpdateLocaleInput) =>
      apiFetch(routes.user.locale(), {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    meta: {
      errorKey: "settings.mutations.user.updateLocale.error",
      successKey: "settings.mutations.user.updateLocale.success",
    },
  });
}

export function useDeleteAccountMutation() {
  return useMutation({
    mutationFn: (data: { confirmation: string }) =>
      apiFetch(routes.user.me(), {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
    meta: {
      errorKey: "settings.mutations.user.deleteAccount.error",
      successKey: "settings.mutations.user.deleteAccount.success",
    },
  });
}
