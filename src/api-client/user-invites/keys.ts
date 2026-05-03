import { userKeys } from "@/api-client/user/keys";

/**
 * Sub-branches off `userKeys.all()` so invalidating the whole user taxonomy
 * (sign-out, account change) wipes pending-invite caches in the same sweep.
 * Coupling is one-way — `userKeys` knows nothing about invites — so a
 * root-level rename in `user/keys.ts` breaks this file at compile time.
 */
export const userInviteKeys = {
  all: () => [...userKeys.all(), "invites"] as const,
};
