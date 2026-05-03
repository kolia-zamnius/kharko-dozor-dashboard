import type { ActivityBucket, UserActivity } from "@/api-client/tracked-users/types";

/** `/activity` returns only non-empty buckets — pre-generate every `[from, to)` slot at `bucketMs` so the histogram has no visual holes. */
export function buildBucketGrid(data: UserActivity): ActivityBucket[] {
  const fromMs = new Date(data.from).getTime();
  const toMs = new Date(data.to).getTime();
  const step = data.bucketMs;

  // Server uses `date_bin` anchored at 2020-01-01; flooring to the unix-epoch
  // step is close enough — 5m/15m/1h all divide evenly into day boundaries.
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
