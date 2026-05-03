/**
 * `byOrg(orgId)` narrows invalidation to one org's slice — a mutation scoped to
 * a single org leaves sibling tabs' caches warm.
 */
export const projectKeys = {
  all: () => ["projects"] as const,
  byOrg: (organizationId: string) => [...projectKeys.all(), { organizationId }] as const,
};
