export type ApiErrorKind =
  | "auth"
  | "permission"
  | "not-found"
  | "conflict"
  | "validation"
  | "rate-limit"
  | "server"
  | "network";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

export function classifyHttpStatus(status: number): ApiErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate-limit";
  if (status >= 500 && status < 600) return "server";
  return "network";
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
