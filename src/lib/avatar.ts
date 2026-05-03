/**
 * DiceBear-backed avatars. Three styles, one per entity kind, so the dashboard
 * never shows ambiguous avatars on a mixed page: `shapes` for platform users
 * (signed-in humans), `glass` for organizations, `big-smile` for tracked users
 * (SDK subjects). Zero infra — same seed → same SVG forever; regenerate-avatar
 * is just a fresh seed.
 */

const DICEBEAR_BASE = "https://api.dicebear.com/9.x";

export function userAvatarUrl(seed: string): string {
  return `${DICEBEAR_BASE}/shapes/svg?seed=${encodeURIComponent(seed)}`;
}

export function orgAvatarUrl(seed: string): string {
  return `${DICEBEAR_BASE}/glass/svg?seed=${encodeURIComponent(seed)}`;
}

/**
 * Seed is compound `projectId:externalId`. Customer SDK integrations choose
 * `externalId`, so two projects can legitimately reuse the same value
 * (`"user-42"`, `"admin"`); salting with `projectId` (cuid) prevents visual
 * collisions across the dashboard.
 */
export function trackedUserAvatarUrl(input: { projectId: string; externalId: string }): string {
  const seed = `${input.projectId}:${input.externalId}`;
  return `${DICEBEAR_BASE}/big-smile/svg?seed=${encodeURIComponent(seed)}`;
}
