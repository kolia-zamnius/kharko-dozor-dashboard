/**
 * Top-level barrel for the client-side API layer.
 *
 * @remarks
 * This file exists mostly as documentation — consumers are expected
 * to import from the feature folder they actually need (e.g.
 * `@/api-client/tracked-users`), because:
 *
 *   1. Per-feature imports tree-shake predictably and let a reviewer
 *      see which slice of the taxonomy is in play without scrolling.
 *   2. Re-exporting every feature here would pull `organizations` into
 *      the bundle of any component that touches `sessions`, and so on
 *      — the opposite of what a split-by-feature layer should cost.
 *
 * The cross-cutting primitives (`apiFetch`, `ApiError`, `routes`) are
 * re-exported here because they're genuinely shared, and consumers
 * rarely need to think about which sibling file owns them.
 */
export { apiFetch } from "./fetch";
export { ApiError, classifyHttpStatus, isApiError } from "./error";
export type { ApiErrorKind } from "./error";
export { routes } from "./routes";
