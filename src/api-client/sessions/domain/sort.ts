import type { SortDir } from "@/api-client/_lib/sort";

export { SORT_DIRECTIONS } from "@/api-client/_lib/sort";

export const SESSION_LIST_SORT_OPTIONS = ["date", "duration"] as const;
export type SessionListSortBy = (typeof SESSION_LIST_SORT_OPTIONS)[number];

export type SessionListSortDir = SortDir;

export const DEFAULT_SESSION_LIST_SORT: SessionListSortBy = "date";
export const DEFAULT_SESSION_LIST_SORT_DIR: SessionListSortDir = "desc";

/** Falls back to default for invalid input — page never errors on a bad `?sort=`. */
export function parseSessionListSortBy(raw: string | null | undefined): SessionListSortBy {
  if (raw && (SESSION_LIST_SORT_OPTIONS as readonly string[]).includes(raw)) {
    return raw as SessionListSortBy;
  }
  return DEFAULT_SESSION_LIST_SORT;
}

export function parseSessionListSortDir(raw: string | null | undefined): SessionListSortDir {
  if (raw === "asc") return "asc";
  return DEFAULT_SESSION_LIST_SORT_DIR;
}
