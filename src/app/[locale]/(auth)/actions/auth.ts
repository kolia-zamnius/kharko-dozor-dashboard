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
 * Logging goes through the shared pino {@link logger} — `info` for
 * normal flow events, `warn` for rate-limit hits / blocked attempts.
 * Email addresses are auto-redacted in production via the logger's
 * `redact` config, so plaintext emails never reach hosted stdout while
 * dev runs still see them. Auth.js itself logs the `?error=` code on
 * failed callbacks, which is what we actually need for incident triage.
 *
 * @see src/app/(auth)/sign-in/components/sign-in-form/index.tsx — client consumer
 * @see src/app/(auth)/sign-up/components/sign-up-form.tsx — client consumer
 * @see src/server/auth/otp/rate-limit.ts — OTP rate-limit source of truth
 */

import { signInSchema, signUpSchema } from "@/app/[locale]/(auth)/validators";
import { queryOtpRateLimit } from "@/server/auth/otp";
import { prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { cookies } from "next/headers";

// ─── Types ───────────────────────────────────────────────

/**
 * Discriminated-union return shape for every Server Action in this file.
 *
 * @remarks
 * Callers narrow on `result.ok`:
 * ```ts
 * const result = await prepareSignIn(email);
 * if (!result.ok) return toast.error(result.error);
 * const { hasPasskey } = result.data;
 * ```
 *
 * `T` defaults to `undefined` for actions that only signal
 * success/failure (no payload) — they still return
 * `{ ok: true, data: undefined }` so the caller can dispatch on
 * `result.ok` with a single pattern.
 *
 * @template T — payload shape returned on success.
 */
type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

type CheckEmailResult = {
  exists: boolean;
  hasPasskey: boolean;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfter?: number;
};

// ─── Actions ─────────────────────────────────────────────

/**
 * Does a user exist for this email, and if so, do they have at least
 * one passkey registered?
 *
 * @remarks
 * Used by {@link prepareSignIn} to decide which sign-in methods to offer
 * in the next step. Safe to call for any email — returns
 * `{ exists: false, hasPasskey: false }` for unknown addresses. This
 * intentionally leaks "account exists" as a signal so the UI can route
 * the user to sign-up early instead of burning an OTP send.
 *
 * @returns `ActionResult<CheckEmailResult>` — `{ exists, hasPasskey }` on success.
 */
export async function checkEmailExists(email: string): Promise<ActionResult<CheckEmailResult>> {
  const parsed = signInSchema.safeParse({ email });
  if (!parsed.success) {
    logger.info({ email }, "checkEmailExists:validation_failed");
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

  logger.info({ email: parsed.data.email, ...result }, "checkEmailExists");

  return { ok: true, data: result };
}

/**
 * Read-only probe of the OTP rate-limit counters for an email.
 *
 * @remarks
 * Does NOT bump the counter — the bump happens inside
 * `generateVerificationToken` in `server/auth/providers.ts` when the
 * code is actually minted. This action lets the UI decide whether to
 * attempt an OTP send at all (daily cap reached, cooldown still
 * active), so the user sees a precise error instead of hitting the
 * auth layer and getting a generic failure.
 *
 * @returns `ActionResult<RateLimitResult>` with `allowed` + optional `retryAfter` seconds.
 * @see src/server/auth/otp/rate-limit.ts
 */
export async function checkOtpRateLimit(email: string): Promise<ActionResult<RateLimitResult>> {
  const status = await queryOtpRateLimit(email);

  if (!status.allowed) {
    const reason = status.retryAfter ? "cooldown" : "daily_limit";
    logger.warn({ email, retryAfter: status.retryAfter }, `checkOtpRateLimit:${reason}`);
  } else {
    logger.info({ email }, "checkOtpRateLimit:allowed");
  }

  return { ok: true, data: status };
}

/**
 * Pre-flight for the sign-up wizard. Validates input, checks the email
 * isn't already registered, probes OTP rate limits, and persists the
 * chosen display name in a short-lived HTTP-only cookie.
 *
 * @remarks
 * The cookie hop is the coupling point between sign-up and the
 * PrismaAdapter's `createUser` override in `server/auth/adapter.ts` —
 * that override reads `pending_name` when Auth.js creates the row
 * after the OTP callback, so the first-party name makes it into the DB
 * without a second round-trip. Cookie TTL is 10 minutes (long enough
 * to survive a slow email delivery), `sameSite: "lax"` because the
 * OTP callback is same-origin, and `httpOnly` so no client script can
 * tamper with it.
 *
 * Error sentinels surfaced to the client: `ACCOUNT_EXISTS`,
 * `RATE_LIMITED`, or a validation message from the zod schema.
 *
 * @returns `ActionResult` — empty success payload; the real signal is `ok`.
 */
export async function prepareSignUp(name: string, email: string): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({ name, email });
  if (!parsed.success) {
    logger.info(
      { name, email, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      "prepareSignUp:validation_failed",
    );
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Existence check and rate-limit probe are independent — parallelise.
  const [existing, rateLimit] = await Promise.all([
    prisma.user.findUnique({ where: { email: parsed.data.email } }),
    queryOtpRateLimit(parsed.data.email),
  ]);

  if (existing) {
    logger.info({ email: parsed.data.email }, "prepareSignUp:account_exists");
    return { ok: false, error: "ACCOUNT_EXISTS" };
  }

  if (!rateLimit.allowed) {
    logger.warn({ email: parsed.data.email }, "prepareSignUp:rate_limited");
    return { ok: false, error: "RATE_LIMITED" };
  }

  const cookieStore = await cookies();
  cookieStore.set("pending_name", parsed.data.name, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    maxAge: 600,
    sameSite: "lax",
  });

  logger.info({ name: parsed.data.name, email: parsed.data.email }, "prepareSignUp:ready");
  return { ok: true, data: undefined };
}

/**
 * Pre-flight for the sign-in wizard. Validates input, ensures the
 * account exists, probes rate limits, and reports whether a passkey is
 * registered so the next step can render the Passkey button in the
 * correct state.
 *
 * @remarks
 * Error sentinels: `ACCOUNT_NOT_FOUND`, `RATE_LIMITED`, or a validation
 * message from the zod schema. `ACCOUNT_NOT_FOUND` is how the
 * EmailStep decides to bounce the user to `/sign-up` instead of
 * showing the method picker.
 *
 * @returns `ActionResult<{ hasPasskey }>` — carried through the
 *   MethodStep so the Passkey button can be disabled (with an
 *   educational hint) when no authenticator is registered yet.
 */
export async function prepareSignIn(email: string): Promise<ActionResult<{ hasPasskey: boolean }>> {
  const parsed = signInSchema.safeParse({ email });
  if (!parsed.success) {
    logger.info(
      { email, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      "prepareSignIn:validation_failed",
    );
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [emailResult, rateLimit] = await Promise.all([
    checkEmailExists(parsed.data.email),
    queryOtpRateLimit(parsed.data.email),
  ]);

  if (!emailResult.ok) return emailResult;

  if (!emailResult.data.exists) {
    logger.info({ email: parsed.data.email }, "prepareSignIn:account_not_found");
    return { ok: false, error: "ACCOUNT_NOT_FOUND" };
  }

  if (!rateLimit.allowed) {
    logger.warn({ email: parsed.data.email }, "prepareSignIn:rate_limited");
    return { ok: false, error: "RATE_LIMITED" };
  }

  logger.info({ email: parsed.data.email, hasPasskey: emailResult.data.hasPasskey }, "prepareSignIn:ready");
  return { ok: true, data: { hasPasskey: emailResult.data.hasPasskey } };
}
