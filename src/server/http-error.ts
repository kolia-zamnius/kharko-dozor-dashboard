import "server-only";

/**
 * Thrown from API routes, permission helpers, and server data loaders. Caught by
 * `withAuth` / `withPublicKey` HOFs in `src/app/api/_lib/` and serialized to a
 * Response — never reaches Sentry. `cause` is preserved in server logs but stripped
 * from the JSON response. Lives at `server/` (not `_lib/`) because non-route code
 * throws it too.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "HttpError";
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}
