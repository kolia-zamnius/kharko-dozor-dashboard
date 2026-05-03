import type { SessionDateRange } from "@/api-client/sessions/domain";

/**
 * Page-level UI tokens — the isomorphic enum lives in `api-client/`, the
 * UI presentation (i18n keys, Tailwind classes) sits with the page that renders.
 */
export const DATE_RANGE_KEYS = {
  today: "today",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
} as const satisfies Record<SessionDateRange, string>;
