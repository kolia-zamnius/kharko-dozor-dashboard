import type { UserActivityStatus } from "@/api-client/tracked-users/status";

/**
 * Tailwind colour tokens for the user-activity status domain enum.
 *
 * @remarks
 * Labels and descriptions for each status live in
 * `src/i18n/messages/<locale>/users.json` under `users.status.*` —
 * consumers call `useTranslations("users.status")` and look them up
 * via `t(\`${status}.label\`)` / `.description`. Only colour tokens
 * stay here because they're Tailwind class strings, not localisable
 * text.
 *
 * Adding a new status variant:
 *   1. Add it to `USER_ACTIVITY_STATUSES` in `api-client/tracked-users/status.ts`.
 *   2. Add `label` + `description` to `users.status.<NEW>` in every
 *      `messages/<locale>/users.json`.
 *   3. Extend `STATUS_COLOR` below — `as const satisfies` turns a
 *      missing bucket into a compile error that walks the compiler
 *      through the UI wiring.
 */
export const STATUS_COLOR = {
  ONLINE: {
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    activeBg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  },
  ACTIVE_24H: {
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    activeBg: "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300",
  },
  IDLE_7D: {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    activeBg: "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300",
  },
  DORMANT: {
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    activeBg: "bg-muted border-border text-foreground",
  },
} as const satisfies Record<UserActivityStatus, { dot: string; text: string; activeBg: string }>;
