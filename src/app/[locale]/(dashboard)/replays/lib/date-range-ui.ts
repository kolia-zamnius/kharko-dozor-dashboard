import type { SessionDateRange } from "@/api-client/sessions/domain";

/**
 * Maps session date-range values to `replays.dateRange.<key>` translation
 * keys. Consumers call `useTranslations("replays.dateRange")` and look up
 * `t(DATE_RANGE_KEYS[range])` — labels live entirely in the JSON bundle,
 * keeping this file a thin compile-time mapping with no user-facing copy.
 *
 * @remarks
 * Colocated with the `/replays` page for the same reason `status-ui.ts`
 * lives under `/users/lib/`: domain enums ship in `api-client/`
 * (isomorphic, server + client), their UI presentation (labels, i18n
 * keys, Tailwind tokens) belongs with the page that actually renders
 * them.
 */
export const DATE_RANGE_KEYS = {
  today: "today",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
} as const satisfies Record<SessionDateRange, string>;
