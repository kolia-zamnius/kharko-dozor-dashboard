import "server-only";

import { prisma } from "@/server/db/client";
import { isHttpError } from "@/server/http-error";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PUBLIC_KEY_CORS_HEADERS, addCorsHeaders } from "./cors";
import { localizeZodError } from "./localize-zod-error";

/**
 * Project row authenticated via `X-Dozor-Public-Key`.
 *
 * @remarks
 * Select-narrow: only the identifier is exposed so a handler can't
 * accidentally leak more of the project row back over CORS.
 */
export type PublicKeyProject = { readonly id: string };

type PublicKeyContext = {
  /** The project whose API key authenticated this request. */
  readonly project: PublicKeyProject;
  /** The original `Request` — handlers read body / headers freely. */
  readonly req: Request;
};

/**
 * Public-key auth HOF — twin of {@link withAuth} for SDK-facing endpoints.
 *
 * @remarks
 * Consumed by `POST /api/ingest` and `POST /api/sessions/cancel`.
 *
 * Responsibilities:
 *   1. Extract `X-Dozor-Public-Key` and resolve it to a `Project` row
 *      (401 on missing / unknown).
 *   2. Decorate every response — success AND error — with CORS headers,
 *      because these endpoints are always called cross-origin.
 *   3. Catch `HttpError` / `ZodError` from the handler (mirrors
 *      {@link withAuth}), so route code doesn't hand-roll error
 *      responses on the happy path.
 *
 * Single `findUnique` on `Project.key` (unique index) — no measurable
 * overhead vs. the pre-HOF inlined version.
 *
 * @param handler - Route body receiving `{ project, req }`.
 * @returns A `(req) => Response` bound to the Next.js route export.
 *
 * @see {@link withAuth} — session-authenticated counterpart.
 */
export function withPublicKey(
  handler: (ctx: PublicKeyContext) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const publicKey = req.headers.get("X-Dozor-Public-Key");
    if (!publicKey) {
      return publicKeyErrorResponse(401, "Missing X-Dozor-Public-Key header");
    }

    const project = await prisma.project.findUnique({
      where: { key: publicKey },
      select: { id: true },
    });

    if (!project) {
      return publicKeyErrorResponse(401, "Invalid API key");
    }

    try {
      const response = await handler({ project, req });
      return addCorsHeaders(response);
    } catch (err) {
      if (isHttpError(err)) {
        return publicKeyErrorResponse(err.status, err.message);
      }
      if (err instanceof ZodError) {
        // Full concat for parity with `withAuth` — the SDK author
        // debugging an ingest payload benefits from the full issue
        // list, same as a form on the dashboard side. Messages are
        // localised via the shared `localizeZodError` helper.
        const { message } = await localizeZodError(err);
        return publicKeyErrorResponse(400, message);
      }
      throw err;
    }
  };
}

function publicKeyErrorResponse(status: number, message: string): Response {
  return NextResponse.json({ error: message }, { status, headers: PUBLIC_KEY_CORS_HEADERS });
}
