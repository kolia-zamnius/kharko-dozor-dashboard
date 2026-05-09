import type { UserActivityStatus } from "@/api-client/tracked-users/domain";

/**
 * Page-level UI tokens — labels live in `messages/{locale}/users.json`,
 * Tailwind classes here. `as const satisfies Record<...>` turns a missing
 * variant into a compile error.
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
