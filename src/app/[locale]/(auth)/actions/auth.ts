"use server";

/**
 * Server Actions backing the sign-in / sign-up wizards.
 *
 * @remarks
 * Every action returns {@link ActionResult} — a discriminated union that
 * forces callers to narrow on `result.ok` before touching `data` or
 * `error`. Error codes exchanged between server and client are kept as
 * string sentinels (`"ACCOUNT_EXISTS"`, `"ACCOUNT_NOT_FOUND"`,
 * `"RATE_LIMITED"`) rather than user-facing prose — the client owns the
 * copy so we can swap wording without re-deploying the server.
 *
 * Logging is gated through {@link devLog} so plaintext email addresses
 * (high-cardinality, mildly sensitive) never reach production stdout.
 * Auth.js itself logs the `?error=` code on failed callbacks, which is
 * what we actually need for incident triage.
 */

import { signInSchema, signUpSchema } from "@/app/[locale]/(auth)/validators";
import { queryOtpRateLimit } from "@/server/auth/otp";
import { prisma } from "@/server/db/client";
import { devLog } from "@/server/dev-log";
import { env } from "@/server/env";
import { cookies } from "next/headers";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

type CheckEmailResult = {
  exists: boolean;
  hasPasskey: boolean;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfter?: number;
};

export async function checkEmailExists(email: string): Promise<ActionResult<CheckEmailResult>> {
  const parsed = signInSchema.safeParse({ email });
  if (!parsed.success) {
    devLog("checkEmailExists:validation_failed", { email });
    return { ok: false, error: "Invalid email" };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: {
      authenticators: { select: { credentialID: true }, take: 1 },
    },
  });

  const result = {
    exists: !!user,
    hasPasskey: (user?.authenticators?.length ?? 0) > 0,
  };

  devLog("checkEmailExists", { email: parsed.data.email, ...result });

  return { ok: true, data: result };
}

export async function checkOtpRateLimit(email: string): Promise<ActionResult<RateLimitResult>> {
  const status = await queryOtpRateLimit(email);

  if (!status.allowed) {
    const reason = status.retryAfter ? "cooldown" : "daily_limit";
    devLog(`checkOtpRateLimit:${reason}`, { email, retryAfter: status.retryAfter });
  } else {
    devLog("checkOtpRateLimit:allowed", { email });
  }

  return { ok: true, data: status };
}

export async function prepareSignUp(name: string, email: string): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({ name, email });
  if (!parsed.success) {
    devLog("prepareSignUp:validation_failed", {
      name,
      email,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    });
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [existing, rateLimit] = await Promise.all([
    prisma.user.findUnique({ where: { email: parsed.data.email } }),
    queryOtpRateLimit(parsed.data.email),
  ]);

  if (existing) {
    devLog("prepareSignUp:account_exists", { email: parsed.data.email });
    return { ok: false, error: "ACCOUNT_EXISTS" };
  }

  if (!rateLimit.allowed) {
    devLog("prepareSignUp:rate_limited", { email: parsed.data.email });
    return { ok: false, error: "RATE_LIMITED" };
  }

  const cookieStore = await cookies();
  cookieStore.set("pending_name", parsed.data.name, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    maxAge: 600,
    sameSite: "lax",
  });

  devLog("prepareSignUp:ready", { name: parsed.data.name, email: parsed.data.email });
  return { ok: true, data: undefined };
}

export async function prepareSignIn(email: string): Promise<ActionResult<{ hasPasskey: boolean }>> {
  const parsed = signInSchema.safeParse({ email });
  if (!parsed.success) {
    devLog("prepareSignIn:validation_failed", { email, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [emailResult, rateLimit] = await Promise.all([
    checkEmailExists(parsed.data.email),
    queryOtpRateLimit(parsed.data.email),
  ]);

  if (!emailResult.ok) return emailResult;

  if (!emailResult.data.exists) {
    devLog("prepareSignIn:account_not_found", { email: parsed.data.email });
    return { ok: false, error: "ACCOUNT_NOT_FOUND" };
  }

  if (!rateLimit.allowed) {
    devLog("prepareSignIn:rate_limited", { email: parsed.data.email });
    return { ok: false, error: "RATE_LIMITED" };
  }

  devLog("prepareSignIn:ready", { email: parsed.data.email, hasPasskey: emailResult.data.hasPasskey });
  return { ok: true, data: { hasPasskey: emailResult.data.hasPasskey } };
}
