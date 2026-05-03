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
 * Auth gate (401 anon) + `HttpError`/`ZodError` boundary so handlers can
 * `throw` without `safeParse`/early-return boilerplate. Anything else
 * re-throws to Next.js's error boundary (unexpected Prisma/connection errors).
 *
 * Awaits Next 16 `params: Promise<P>` for the dynamic-route overload.
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
        // Issues retain `field.sub: message` path prefixes so the client
        // routes each one to the right input without re-parsing.
        const { message, issues } = await localizeZodError(err);
        return NextResponse.json({ error: message, issues }, { status: 400 });
      }
      throw err;
    }
  };
}
