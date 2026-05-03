/**
 * Invalidating `detail(orgId)` cascades to `members(orgId)` + `invites(orgId)` via
 * TanStack prefix-match — call after any membership / invite mutation.
 * `memberRoleMutation` is a mutation-only key (no matching query) — `useIsMutating({ mutationKey })`
 * lets sibling rows observe an in-flight role change without prop-drilling
 * `isPending` from a parent-owned mutation instance.
 */
export const organizationKeys = {
  all: () => ["organizations"] as const,
  detail: (orgId: string) => [...organizationKeys.all(), orgId] as const,
  members: (orgId: string) => [...organizationKeys.detail(orgId), "members"] as const,
  invites: (orgId: string) => [...organizationKeys.detail(orgId), "invites"] as const,
  memberRoleMutation: (orgId: string) => [...organizationKeys.members(orgId), "role"] as const,
};
