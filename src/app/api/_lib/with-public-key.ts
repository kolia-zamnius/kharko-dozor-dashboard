import "server-only";

import { prisma } from "@/server/db/client";
import { isHttpError } from "@/server/http-error";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PUBLIC_KEY_CORS_HEADERS, addCorsHeaders } from "./cors";
import { localizeZodError } from "./localize-zod-error";

/** Select-narrow — handlers can't accidentally leak more of the project row back over CORS. */
export type PublicKeyProject = { readonly id: string };

type PublicKeyContext = {
  readonly project: PublicKeyProject;
  readonly req: Request;
};

/**
 * Twin of `withAuth` for SDK-facing endpoints (`/api/ingest`,
 * `/api/sessions/cancel`). Resolves `X-Dozor-Public-Key` to a project (401
 * on missing/unknown), decorates every response with CORS, catches
 * `HttpError`/`ZodError` like `withAuth`.
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
        // Full concat — SDK authors debugging an ingest payload want every issue.
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
