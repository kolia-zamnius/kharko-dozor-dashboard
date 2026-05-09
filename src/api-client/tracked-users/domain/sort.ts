import type { SortDir } from "@/api-client/_lib/sort";

export { SORT_DIRECTIONS } from "@/api-client/_lib/sort";

export const USER_LIST_SORT_OPTIONS = ["last-seen", "sessions", "active-time", "newest"] as const;
export type UserListSortBy = (typeof USER_LIST_SORT_OPTIONS)[number];

export type UserListSortDir = SortDir;

export const DEFAULT_USER_LIST_SORT: UserListSortBy = "last-seen";
export const DEFAULT_USER_LIST_SORT_DIR: UserListSortDir = "desc";

export function parseUserListSortBy(raw: string | null | undefined): UserListSortBy {
  if (raw && (USER_LIST_SORT_OPTIONS as readonly string[]).includes(raw)) {
    return raw as UserListSortBy;
  }
  return DEFAULT_USER_LIST_SORT;
}

export function parseUserListSortDir(raw: string | null | undefined): UserListSortDir {
  if (raw === "asc") return "asc";
  return DEFAULT_USER_LIST_SORT_DIR;
}
