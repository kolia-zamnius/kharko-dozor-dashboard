/**
 * `user-invites/keys.ts` composes its root off `userKeys.all()` — invalidating
 * `["user"]` (e.g. on sign-out / account change) wipes pending-invite caches in
 * the same sweep. The link is implicit at runtime, so re-keying this root means
 * re-syncing the invites factory too.
 */
export const userKeys = {
  all: () => ["user"] as const,
  profile: () => [...userKeys.all(), "profile"] as const,
};
