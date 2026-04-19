"use client";

import { useSession } from "next-auth/react";

import { useOrganizationsQuery } from "@/api-client/organizations/queries";

/**
 * Resolves whether the signed-in user can perform ADMIN-level actions
 * in the currently active organization.
 *
 * @remarks
 * Derives the capability client-side from two shared-cache reads:
 *   - `useSession()` — gives us `activeOrganizationId` from the JWT.
 *   - `useOrganizationsQuery()` — classic (non-Suspense) hook that the
 *      global nav already warms, so we reuse its cache entry and
 *      tolerate an in-flight `undefined` with `?.`.
 *
 * This hook is the single source of truth for the "can I edit admin
 * surfaces?" check on list shells. Previously duplicated in
 * `sessions-list-shell.tsx` and `user-detail-shell.tsx`; any future
 * list shell that needs the same gate should import this instead of
 * re-deriving.
 *
 * The matching server-side guard is `requireMember(..., "ADMIN")` in
 * `src/server/auth/permissions.ts` — see that module's JSDoc for the
 * full OWNER / ADMIN / VIEWER capability matrix. UI hides what the
 * API will 403 anyway (double-validation).
 *
 * @returns `true` when the active-org membership is OWNER or ADMIN;
 *   `false` for VIEWER, during initial load, or when the active org
 *   can't be found in the membership list.
 */
export function useCanManageActiveOrg(): boolean {
  const { data: session } = useSession();
  const { data: organizations } = useOrganizationsQuery();

  const activeOrgId = session?.user?.activeOrganizationId;
  if (!activeOrgId) return false;

  const activeOrg = organizations?.find((o) => o.id === activeOrgId);
  return activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";
}
