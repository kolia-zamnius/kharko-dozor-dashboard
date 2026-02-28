/**
 * Query-key factory for the `organizations` feature.
 *
 * @remarks
 * Hierarchical TanStack Query keys — see `src/api-client/user/keys.ts`
 * for the rationale. Current shape:
 *
 *   organizationKeys.all()              // ["organizations"]
 *   organizationKeys.detail(orgId)      // ["organizations", orgId]
 *   organizationKeys.members(orgId)     // ["organizations", orgId, "members"]
 *   organizationKeys.invites(orgId)     // ["organizations", orgId, "invites"]
 *
 * Invalidating `organizationKeys.detail(orgId)` wipes `members` and
 * `invites` for that org too, which is the usual call after a
 * membership or invite mutation. `organizationKeys.all()` is the nuke
 * button for logout / org-switched scenarios.
 */
export const organizationKeys = {
  all: () => ["organizations"] as const,
  detail: (orgId: string) => [...organizationKeys.all(), orgId] as const,
  members: (orgId: string) => [...organizationKeys.detail(orgId), "members"] as const,
  invites: (orgId: string) => [...organizationKeys.detail(orgId), "invites"] as const,
};
