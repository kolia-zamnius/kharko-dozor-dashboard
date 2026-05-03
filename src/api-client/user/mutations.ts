import { apiFetch } from "@/api-client/fetch";
import { routes } from "@/api-client/routes";
import { userQueries } from "@/api-client/user/queries";
import type { UpdateLocaleInput } from "@/api-client/user/validators";
import { signalUnknownCredential } from "@/lib/signal-unknown-credential";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signIn } from "next-auth/webauthn";
import { useSession } from "next-auth/react";

/** Profile mutations also nudge the session — JWT carries `name`/`image` claims. */
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

      // Tell the browser this credential is gone (Chrome 132+) so autofill
      // drops it. Feature-detected + error-swallowing inside the wrapper.
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
 * Just the server write + toast — no session/router refresh here. The locale
 * section composes those in `onSuccess` because the right behaviour is UI-specific
 * (re-navigate to the same pathname under the new locale prefix to re-render the tree).
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
