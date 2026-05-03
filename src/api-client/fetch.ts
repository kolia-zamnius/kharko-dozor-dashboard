import { ApiError, classifyHttpStatus } from "./error";

export type ApiFetchServerBridge = (
  url: string,
  init: RequestInit | undefined,
) => Promise<{ url: string; init: RequestInit }>;

declare global {
  var __apiFetchServerBridge: ApiFetchServerBridge | undefined;
}

/**
 * Auth headers / retry / response validation deliberately NOT here — cookies
 * ride transparently, retries live in {@link src/lib/query-client.ts} where
 * they can read `ApiError.kind`. Callers MUST thread `init.signal` for cancellation.
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let finalUrl = url;
  let finalInit: RequestInit | undefined = init;

  if (typeof window === "undefined" && url.startsWith("/")) {
    const bridge = globalThis.__apiFetchServerBridge;
    if (!bridge) {
      // Loud message — replaces Node's obscure `Failed to parse URL`.
      throw new Error(
        "apiFetch: server-side relative URL cannot be resolved — the " +
          "server-only bridge is not registered. Import " +
          "`@/api-client/fetch-server-bridge` as a side-effect from a " +
          "Server Component that's always in the render tree " +
          "(e.g. `src/app/[locale]/layout.tsx`).",
      );
    }
    const resolved = await bridge(url, init);
    finalUrl = resolved.url;
    finalInit = resolved.init;
  }

  const headers = new Headers(finalInit?.headers);
  if (finalInit?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(finalUrl, { ...finalInit, headers });
  } catch (cause) {
    // Rethrow AbortError as-is — wrapping into `ApiError("network", ...)` would
    // leak cancellation into the network retry policy.
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }

    const message = cause instanceof Error ? cause.message : "Network error";
    throw new ApiError("network", 0, message, { cause });
  }

  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    const message = body.error || `Request failed (${res.status})`;
    throw new ApiError(classifyHttpStatus(res.status), res.status, message);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}
