/**
 * Deterministic avatar URL builders backed by DiceBear's HTTP API.
 *
 * Why not store binary avatars: zero infra. Every entity carries a stable
 * seed (cuid/uuid/externalId), and DiceBear renders the same SVG for the
 * same seed forever. We don't pay for storage, don't worry about uploads,
 * and the regenerate-avatar feature is just "give me a fresh seed".
 *
 * Three visual styles, one per entity kind, so people can tell at a glance
 * what they're looking at:
 *   - `shapes`    (geometric fills, soft pastels)  → dashboard users
 *     (platform accounts — the people who sign in)
 *   - `glass`     (frosted-glass blobs)            → organizations
 *   - `big-smile` (cartoon faces with smiles)      → tracked users
 *     (end users captured by the SDK on customer sites — DIFFERENT
 *     visual language from platform accounts, because seeing both
 *     styles on the same page must never be ambiguous)
 *
 * The seed is URL-encoded to be safe for arbitrary inputs — DiceBear is
 * tolerant but `encodeURIComponent` is the cheap belt-and-braces.
 */

const DICEBEAR_BASE = "https://api.dicebear.com/9.x";

export function userAvatarUrl(seed: string): string {
  return `${DICEBEAR_BASE}/shapes/svg?seed=${encodeURIComponent(seed)}`;
}

export function orgAvatarUrl(seed: string): string {
  return `${DICEBEAR_BASE}/glass/svg?seed=${encodeURIComponent(seed)}`;
}

/**
 * Tracked-user avatars (SDK-captured end users on `/users`). Uses the
 * `big-smile` DiceBear style — visually distinct from dashboard-user
 * `shapes` so the two concepts can never be confused on screen.
 *
 * The seed is **intentionally compound**: `{projectId}:{externalId}`.
 * `externalId` alone is controlled by the customer's SDK integration
 * — two different customer projects could legitimately reuse the same
 * external id (`"user-42"`, `"admin"`, etc.), and without salting by
 * project those rows would visually collide across the whole
 * dashboard. Prefixing with `projectId` (cuid, unguessable, unique
 * per project) guarantees every `(project, external)` pair maps to a
 * different-looking avatar even when the external parts overlap.
 *
 * If you're about to render an avatar for a `TrackedUser` row, use
 * this helper; for a `User` (dashboard account) row use `userAvatarUrl`.
 */
export function trackedUserAvatarUrl(input: { projectId: string; externalId: string }): string {
  const seed = `${input.projectId}:${input.externalId}`;
  return `${DICEBEAR_BASE}/big-smile/svg?seed=${encodeURIComponent(seed)}`;
}
