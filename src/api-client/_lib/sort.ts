/** `desc` first — newest-on-top is the dominant default across list pages. */
export const SORT_DIRECTIONS = ["desc", "asc"] as const;
export type SortDir = (typeof SORT_DIRECTIONS)[number];
