import { withAuth } from "@/app/api/_lib/with-auth";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";

type Params = { provider: string };

/**
 * Unlinks the local `Account` row only — provider-side consent stays.
 *
 * Last-login-method guard: counts other OAuth + passkeys + OTP-availability
 * (`User.emailVerified` non-null — Nodemailer is always wired but unverified
 * emails can't receive the magic code). Zero remaining → 409, row preserved.
 *
 * Concurrency — `Serializable` is what actually enforces the guard. Read-
 * committed lets two txns both see `remaining=1` and both delete, dropping to
 * zero. Predicate-locking surfaces the conflict as `P2034` → 500; UI users
 * retrying lands cleanly on the 409 branch. No auto-retry — this is UI-driven,
 * a clear error beats silent success if the guard is firing.
 */
export const DELETE = withAuth<Params>(async (req, user, { provider }) => {
  return await prisma.$transaction(
    async (tx) => {
      // 404 lookup BEFORE method-count arithmetic so the response is
      // identical regardless of login-method posture — no side channel.
      const target = await tx.account.findFirst({
        where: { userId: user.id, provider },
        select: { id: true },
      });

      if (!target) {
        throw new HttpError(404, "Account not found");
      }

      // Methods remaining AFTER the hypothetical unlink.
      const [otherAccountCount, authenticatorCount, dbUser] = await Promise.all([
        tx.account.count({
          where: { userId: user.id, provider: { not: provider } },
        }),
        tx.authenticator.count({ where: { userId: user.id } }),
        tx.user.findUnique({
          where: { id: user.id },
          select: { emailVerified: true },
        }),
      ]);

      const emailOtpAvailable = dbUser?.emailVerified != null;
      const remainingMethods = otherAccountCount + authenticatorCount + (emailOtpAvailable ? 1 : 0);

      if (remainingMethods === 0) {
        log.warn("user:account:unlink:blocked_last_method", { userId: user.id, provider });
        throw new HttpError(409, "Cannot unlink the last login method");
      }

      await tx.account.delete({ where: { id: target.id } });

      log.info("user:account:unlink:ok", {
        userId: user.id,
        provider,
        remainingMethods,
      });

      return new Response(null, { status: 204 });
    },
    { isolationLevel: "Serializable" },
  );
});
