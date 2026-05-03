/** Cross-cutting primitives only — feature consumers import from `@/api-client/<feature>` directly. */
export { apiFetch } from "./fetch";
export { ApiError, classifyHttpStatus, isApiError } from "./error";
export type { ApiErrorKind } from "./error";
export { routes } from "./routes";
