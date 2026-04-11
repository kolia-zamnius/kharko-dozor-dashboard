/**
 * Invoke a Next.js App Router route handler directly, no server required.
 *
 * @remarks
 * App Router route handlers are `(req: Request, ctx?: { params: Promise<P> }) => Promise<Response>`
 * — pure functions. Calling them in tests needs only a `Request` and a
 * resolved-promise wrapper for dynamic route params. We don't use
 * `next-test-api-route-handler`: NTARH was essential for the Pages Router
 * magic, but in App Router it just adds a dependency that lags each Next
 * release.
 *
 * The helper standardises Request construction (method, JSON encoding,
 * URL fallback) and unwraps the Response into `{ status, json, text }`
 * so assertions read cleanly: `expect(status).toBe(401)` instead of
 * `expect(response.status).toBe(401); expect(await response.json()).toMatch…`.
 */

type InvokeOptions = {
  method: string;
  url?: string;
  body?: unknown;
  headers?: HeadersInit;
};

type InvokeResult<TResp> = {
  /** Raw Response — use for tests that need to inspect headers (CORS, Cache-Control). */
  response: Response;
  /** Shortcut for `response.status`. */
  status: number;
  /** Parsed JSON body, `null` if the response had no body or wasn't JSON. */
  json: TResp;
  /** Raw text body (useful for asserting non-JSON payloads, e.g. HTML emails). */
  text: string;
};

function buildRequest(opts: InvokeOptions): Request {
  const url = opts.url ?? "http://localhost/test";
  const headers = new Headers(opts.headers);

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    body = JSON.stringify(opts.body);
  }

  return new Request(url, { method: opts.method, headers, body });
}

async function unwrap<TResp>(response: Response): Promise<InvokeResult<TResp>> {
  const text = await response.clone().text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response — leave json as null, `text` still carries the body.
    }
  }
  return { response, status: response.status, json: json as TResp, text };
}

/**
 * Invoke a Next.js App Router route handler that takes NO dynamic params
 * (bare `GET`, `POST`, etc. without `[foo]/` segments in the path).
 *
 * @remarks
 * Split from {@link invokeRouteWithParams} because TypeScript's Promise
 * variance rejects a single signature that accepts both
 * `(req) => Response` and `(req, ctx) => Response` — the contravariant
 * narrowing fails. Two helpers with tight type bounds each is the
 * cleanest answer; the shared plumbing lives in the module-private
 * `buildRequest` + `unwrap` above.
 */
export async function invokeRoute<TResp = unknown>(
  handler: (req: Request) => Promise<Response> | Response,
  opts: InvokeOptions,
): Promise<InvokeResult<TResp>> {
  const response = await handler(buildRequest(opts));
  return unwrap<TResp>(response);
}

/**
 * Invoke a Next.js App Router route handler with dynamic params
 * (`[projectId]`, `[credentialId]`, etc. — handlers typed as
 * `withAuth<Params>(...)`).
 *
 * @remarks
 * Wraps the params in the `Promise.resolve(...)` shape Next.js 16
 * passes in production, so the SUT sees the exact same
 * `{ params: Promise<P> }` context it receives on a real request. Per
 * the split explained on {@link invokeRoute}, this is its own helper —
 * not an overload — so the type parameters on both sides stay tight.
 *
 * @example
 * ```ts
 * const { status } = await invokeRouteWithParams(route.DELETE, {
 *   method: "DELETE",
 *   params: { projectId: project.id },
 * });
 * expect(status).toBe(204);
 * ```
 */
export async function invokeRouteWithParams<P extends Record<string, string>, TResp = unknown>(
  handler: (req: Request, ctx: { params: Promise<P> }) => Promise<Response> | Response,
  opts: InvokeOptions & { params: P },
): Promise<InvokeResult<TResp>> {
  const response = await handler(buildRequest(opts), { params: Promise.resolve(opts.params) });
  return unwrap<TResp>(response);
}
