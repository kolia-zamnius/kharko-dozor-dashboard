/**
 * App Router route handlers are pure `(req, ctx?) => Promise<Response>` fns —
 * no NTARH needed. The helper standardises `Request` construction and unwraps
 * `Response` into `{ status, json, text }` so assertions read clean.
 */

type InvokeOptions = {
  method: string;
  url?: string;
  body?: unknown;
  headers?: HeadersInit;
};

type InvokeResult<TResp> = {
  /** Use when a test needs to inspect headers (CORS, Cache-Control). */
  response: Response;
  status: number;
  /** `null` if the body was empty or not JSON. */
  json: TResp;
  /** Raw text — useful for non-JSON payloads (HTML emails). */
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
      // Non-JSON — leave json null, `text` still carries the body.
    }
  }
  return { response, status: response.status, json: json as TResp, text };
}

/**
 * Split from `invokeRouteWithParams` because TS Promise variance rejects one
 * signature accepting both `(req)` and `(req, ctx)` shapes — contravariant
 * narrowing fails. Two tight-typed helpers; shared plumbing stays private.
 */
export async function invokeRoute<TResp = unknown>(
  handler: (req: Request) => Promise<Response> | Response,
  opts: InvokeOptions,
): Promise<InvokeResult<TResp>> {
  const response = await handler(buildRequest(opts));
  return unwrap<TResp>(response);
}

/** Wraps params in `Promise.resolve(...)` to mirror the `{ params: Promise<P> }` shape Next.js 16 passes in production. */
export async function invokeRouteWithParams<P extends Record<string, string>, TResp = unknown>(
  handler: (req: Request, ctx: { params: Promise<P> }) => Promise<Response> | Response,
  opts: InvokeOptions & { params: P },
): Promise<InvokeResult<TResp>> {
  const response = await handler(buildRequest(opts), { params: Promise.resolve(opts.params) });
  return unwrap<TResp>(response);
}
