/**
 * Query-key factory for the `projects` feature.
 *
 * @remarks
 * Hierarchical TanStack Query keys — see `src/api-client/user/keys.ts`
 * for the rationale. Invalidation with `projectKeys.all()` nukes both
 * the global list and every per-org slice; a mutation scoped to one
 * org can narrow to `projectKeys.byOrg(orgId)` and leave the other
 * tabs' caches alone.
 */
export const projectKeys = {
  all: () => ["projects"] as const,
  byOrg: (organizationId: string) => [...projectKeys.all(), { organizationId }] as const,
};
