/**
 * Query-key factory for the `user` feature.
 *
 * @remarks
 * Canonical TanStack Query pattern — hierarchical keys built up from
 * an `all()` root so every level can be passed to
 * `invalidateQueries({ queryKey })` and match all descendants in one
 * shot.
 *
 *   userKeys.all()        // ["user"]                   — everything
 *   userKeys.profile()    // ["user", "profile"]        — the profile query
 *
 * Invalidation matches by prefix: passing `userKeys.all()` invalidates
 * the profile, any future sub-queries, and anything else keyed under
 * `"user"` — without enumerating them. Every key returns `as const`
 * readonly tuples so consumers can't mutate them and TypeScript infers
 * tight literal types for the whole chain.
 *
 * **Cross-feature coupling note.** `user-invites/keys.ts` intentionally
 * composes its root off `userKeys.all()` — so calling
 * `invalidateQueries({ queryKey: userKeys.all() })` also wipes the
 * pending-invites cache. That's the desired sign-out / account-change
 * behaviour (both surfaces are "things about the signed-in user"), but
 * the link is implicit at runtime, so if you re-key the root here you
 * must re-sync the invites factory too.
 *
 * @see src/api-client/user-invites/keys.ts
 */
export const userKeys = {
  all: () => ["user"] as const,
  profile: () => [...userKeys.all(), "profile"] as const,
};
