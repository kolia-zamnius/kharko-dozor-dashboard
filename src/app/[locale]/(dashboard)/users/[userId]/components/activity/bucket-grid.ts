import type { ActivityBucket, UserActivity } from "@/api-client/tracked-users/types";

/**
 * Materialize a full grid of buckets from the sparse API response.
 *
 * The `/activity` endpoint only returns buckets that actually have events.
 * For a consistent histogram — fixed bar count, stable x-axis, no visual
 * "holes" between sparse activity — we pre-generate every slot covering
 * `[from, to)` at `bucketMs` intervals and overlay the server totals where
 * they exist. Buckets are keyed by their start timestamp in milliseconds.
 *
 * Pure function, colocated with its only consumer (`ActivityHistogram`).
 * Kept outside the component file so the render code stays readable and
 * the grid-building logic is trivially testable in isolation.
 */
export function buildBucketGrid(data: UserActivity): ActivityBucket[] {
  const fromMs = new Date(data.from).getTime();
  const toMs = new Date(data.to).getTime();
  const step = data.bucketMs;

  // Align `fromMs` to the same grid the server uses (`date_bin` anchored
  // at 2020-01-01). We approximate by flooring to a step boundary relative
  // to the unix epoch, which is close enough given our step sizes
  // (5m / 15m / 1h) all divide evenly into day/hour boundaries.
  const alignedFrom = Math.floor(fromMs / step) * step;

  const server = new Map<number, ActivityBucket>();
  for (const b of data.buckets) {
    server.set(new Date(b.t).getTime(), b);
  }

  const out: ActivityBucket[] = [];
  for (let t = alignedFrom; t < toMs; t += step) {
    const existing = server.get(t);
    out.push(existing ?? { t: new Date(t).toISOString(), total: 0, byPage: [] });
  }
  return out;
}
