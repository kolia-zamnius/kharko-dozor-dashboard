import "server-only";

import { auth } from "@/server/auth";
import { isHttpError } from "@/server/http-error";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { localizeZodError } from "./localize-zod-error";

export type SessionUser = Session["user"];

export function withAuth(
  handler: (req: Request, user: SessionUser) => Promise<Response>,
): (req: Request) => Promise<Response>;

export function withAuth<P>(
  handler: (req: Request, user: SessionUser, params: P) => Promise<Response>,
): (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

/**
 * Auth guard + error boundary for API route handlers.
 *
 * @remarks
 * Responsibilities:
 *   1. Resolve the Auth.js session, 401 anonymous requests.
 *   2. Await dynamic route params (Next.js 16 async params contract).
 *   3. Catch `HttpError` / `ZodError` from the handler and serialise to
 *      JSON responses — handlers just `throw`, no `safeParse` +
 *      early-return boilerplate.
 *
 * Any other exception re-throws so Next.js mounts its own error
 * boundary (unexpected Prisma / connection errors).
 *
 * @see {@link HttpError} — thrown from permission helpers + route logic.
 * @see {@link withPublicKey} — twin HOF for SDK-facing public-key routes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAuth(handler: any) {
  return async (req: Request, ctx?: { params: Promise<unknown> }) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      if (ctx?.params) {
        return await handler(req, session.user, await ctx.params);
      }
      return await handler(req, session.user);
    } catch (err) {
      if (isHttpError(err)) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        // Localise every issue via the `errors.validation` namespace
        // (see `localizeZodError` for the rebuild logic), then
        // concatenate so a form with three invalid fields surfaces all
        // three. Each issue keeps its path prefix (`field.sub: message`)
        // so the client can route the message to the right input
        // without a second parse.
        const { message, issues } = await localizeZodError(err);
        return NextResponse.json({ error: message, issues }, { status: 400 });
      }
      throw err;
    }
  };
}
