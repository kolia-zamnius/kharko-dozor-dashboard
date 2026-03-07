import { withAuth } from "@/app/api/_lib/with-auth";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";

type Params = { provider: string };

/**
 * `DELETE /api/user/accounts/[provider]` — unlink a linked OAuth account.
 *
 * @remarks
 * Only unlinks the local `Account` row — does NOT revoke the
 * provider-side consent (users manage that in Google / GitHub
 * settings).
 *
 * ### Last-login-method guard
 * Before deleting, the route verifies at least one sign-in path
 * remains for the caller afterwards. Login methods in this app
 * (see `src/server/auth/providers.ts` — the source of truth):
 *
 *   - **Other OAuth accounts** — remaining `Account` rows where
 *     `provider !== :provider`.
 *   - **Passkeys** — any `Authenticator` row for the user.
 *   - **Email OTP** (`Nodemailer` provider) — available whenever
 *     `User.emailVerified` is non-null. `Nodemailer` itself is
 *     always configured (`GMAIL_*` env is required), but an
 *     unverified email can't receive the magic-code link, so the
 *     flag is the right signal.
 *
 * If the prospective delete would leave ZERO of these, the route
 * returns `409 Cannot unlink the last login method` and the row is
 * preserved. Without this guard a user with only one linked OAuth
 * account could accidentally lock themselves out with a single click.
 *
 * ### Concurrency
 * The count + delete run inside a `$transaction` with `Serializable`
 * isolation. This is what actually enforces the guard under a
 * concurrent race — read-committed (Postgres default) lets two
 * transactions both see "remaining=1", both pass the guard, and both
 * commit deletes, dropping the user to zero methods. Serializable
 * uses predicate locking: the second conflicting transaction fails
 * with `P2034` (Prisma's `TransactionRollbackError`) and Prisma
 * surfaces it as a thrown error. The caller sees 500; retrying once
 * is safe and lands on the 409 branch. We don't auto-retry because
 * this flow is UI-driven (a user clicking twice) — a clear error
 * trumps silent success if the guard is firing.
 */
export const DELETE = withAuth<Params>(async (req, user, { provider }) => {
  return await prisma.$transaction(
    async (tx) => {
      // 404 on missing target BEFORE the method-count arithmetic so the
      // response is identical regardless of the caller's login-method
      // posture — the 404 path can't become a side channel that leaks
      // method counts.
      const target = await tx.account.findFirst({
        where: { userId: user.id, provider },
        select: { id: true },
      });

      if (!target) {
        throw new HttpError(404, "Account not found");
      }

      // Remaining methods AFTER the hypothetical unlink.
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
        throw new HttpError(409, "Cannot unlink the last login method");
      }

      await tx.account.delete({ where: { id: target.id } });
      return new Response(null, { status: 204 });
    },
    { isolationLevel: "Serializable" },
  );
});
