"use server";

/**
 * Error codes are string sentinels (`"ACCOUNT_EXISTS"`, `"RATE_LIMITED"`) so
 * the client owns the copy — wording changes without re-deploying the server.
 */

import { signInSchema, signUpSchema } from "@/app/[locale]/(auth)/validators";
import { queryOtpRateLimit } from "@/server/auth/otp";
import { prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { log } from "@/server/logger";
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
    log.info("auth:email_check:validation_failed", { email });
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

  log.info("auth:email_check:ok", { email: parsed.data.email, ...result });

  return { ok: true, data: result };
}

export async function checkOtpRateLimit(email: string): Promise<ActionResult<RateLimitResult>> {
  const status = await queryOtpRateLimit(email);

  if (!status.allowed) {
    const reason = status.retryAfter ? "cooldown" : "daily_limit";
    log.warn(`auth:otp:${reason}_blocked`, { email, retryAfter: status.retryAfter });
  } else {
    log.info("auth:otp:rate_limit_ok", { email });
  }

  return { ok: true, data: status };
}

export async function prepareSignUp(name: string, email: string): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({ name, email });
  if (!parsed.success) {
    log.info("auth:signup:validation_failed", {
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
    log.info("auth:signup:account_exists", { email: parsed.data.email });
    return { ok: false, error: "ACCOUNT_EXISTS" };
  }

  if (!rateLimit.allowed) {
    log.warn("auth:signup:rate_limited", { email: parsed.data.email });
    return { ok: false, error: "RATE_LIMITED" };
  }

  const cookieStore = await cookies();
  cookieStore.set("pending_name", parsed.data.name, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    maxAge: 600,
    sameSite: "lax",
  });

  log.info("auth:signup:ready", { name: parsed.data.name, email: parsed.data.email });
  return { ok: true, data: undefined };
}

export async function prepareSignIn(email: string): Promise<ActionResult<{ hasPasskey: boolean }>> {
  const parsed = signInSchema.safeParse({ email });
  if (!parsed.success) {
    log.info("auth:signin:validation_failed", {
      email,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    });
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [emailResult, rateLimit] = await Promise.all([
    checkEmailExists(parsed.data.email),
    queryOtpRateLimit(parsed.data.email),
  ]);

  if (!emailResult.ok) return emailResult;

  if (!emailResult.data.exists) {
    log.info("auth:signin:account_not_found", { email: parsed.data.email });
    return { ok: false, error: "ACCOUNT_NOT_FOUND" };
  }

  if (!rateLimit.allowed) {
    log.warn("auth:signin:rate_limited", { email: parsed.data.email });
    return { ok: false, error: "RATE_LIMITED" };
  }

  log.info("auth:signin:ready", { email: parsed.data.email, hasPasskey: emailResult.data.hasPasskey });
  return { ok: true, data: { hasPasskey: emailResult.data.hasPasskey } };
}
