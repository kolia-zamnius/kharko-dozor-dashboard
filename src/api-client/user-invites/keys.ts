import { userKeys } from "@/api-client/user/keys";

/**
 * Query-key factory for the `user-invites` feature.
 *
 * @remarks
 * Sub-branches off `userKeys.all()` so that invalidating the whole
 * user taxonomy (e.g. on sign-out or active-org switch) also clears
 * pending-invite caches in one sweep. The features share a taxonomy
 * root, not a folder — this is why the key references the sibling
 * factory rather than hard-coding `"user"`.
 *
 * **Direction of the coupling.** `user-invites` depends on `user`, not
 * the other way around: the invites factory composes off
 * `userKeys.all()`, but `userKeys` knows nothing about invites. That's
 * the reason this cross-ref is here and not a two-way link — a
 * root-level rename on the user side breaks this file at compile
 * time, while the reverse direction is safe.
 *
 * @see src/api-client/user/keys.ts
 */
export const userInviteKeys = {
  all: () => [...userKeys.all(), "invites"] as const,
};
