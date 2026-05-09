import { SESSION_RETENTION_MS, SEVEN_DAYS_MS, THIRTY_DAYS_MS } from "@/lib/time";

/**
 * `90d` is the widest preset (not "All time") because sessions older than
 * `SESSION_RETENTION_DAYS` are hard-deleted by the nightly cron — advertising
 * "All time" while the DB physically can't hold older data was a UX lie.
 * Adjusting retention in `lib/time.ts` flips the lower bound automatically via
 * `dateRangeToFrom`'s anchor on `SESSION_RETENTION_MS`.
 */
export const SESSION_DATE_RANGES = ["today", "7d", "30d", "90d"] as const;
export type SessionDateRange = (typeof SESSION_DATE_RANGES)[number];

export const DEFAULT_SESSION_DATE_RANGE: SessionDateRange = "90d";

export function dateRangeToFrom(range: SessionDateRange, now = new Date()): Date {
  switch (range) {
    case "today": {
      const d = new Date(now);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    case "7d":
      return new Date(now.getTime() - SEVEN_DAYS_MS);
    case "30d":
      return new Date(now.getTime() - THIRTY_DAYS_MS);
    case "90d":
      return new Date(now.getTime() - SESSION_RETENTION_MS);
  }
}

export function parseSessionDateRange(raw: string | null | undefined): SessionDateRange {
  if (raw && (SESSION_DATE_RANGES as readonly string[]).includes(raw)) {
    return raw as SessionDateRange;
  }
  return DEFAULT_SESSION_DATE_RANGE;
}
