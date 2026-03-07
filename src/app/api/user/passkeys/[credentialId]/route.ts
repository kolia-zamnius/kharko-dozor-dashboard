import { withAuth } from "@/app/api/_lib/with-auth";
import { renamePasskeySchema } from "@/api-client/user/validators";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";

type Params = { credentialId: string };

/**
 * `PATCH /api/user/passkeys/[credentialId]` — rename a registered passkey.
 *
 * @remarks
 * Lets the user distinguish "MacBook Touch ID" from "iPhone Face ID"
 * in the authenticators list. Scoped by `(credentialID, userId)` so
 * a credentialID leak can't let another user rename the passkey.
 */
export const PATCH = withAuth<Params>(async (req, user, { credentialId }) => {
  const body = renamePasskeySchema.parse(await req.json());

  const result = await prisma.authenticator.updateMany({
    where: { credentialID: credentialId, userId: user.id },
    data: { name: body.name },
  });

  if (result.count === 0) {
    throw new HttpError(404, "Passkey not found");
  }

  return new Response(null, { status: 204 });
});

/**
 * `DELETE /api/user/passkeys/[credentialId]` — unregister a passkey.
 *
 * @remarks
 * Same `(credentialID, userId)` scoping as rename — leak-safe.
 * The account stays usable via other authenticators (OAuth, OTP) as
 * long as at least one remains.
 */
export const DELETE = withAuth<Params>(async (req, user, { credentialId }) => {
  const result = await prisma.authenticator.deleteMany({
    where: { credentialID: credentialId, userId: user.id },
  });

  if (result.count === 0) {
    throw new HttpError(404, "Passkey not found");
  }

  return new Response(null, { status: 204 });
});
