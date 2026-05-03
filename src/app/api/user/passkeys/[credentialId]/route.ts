import { withAuth } from "@/app/api/_lib/with-auth";
import { renamePasskeySchema } from "@/api-client/user/validators";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";

type Params = { credentialId: string };

/** `(credentialID, userId)` scoping — a credentialID leak can't let another user rename it. 404 (not 403) — no existence oracle. */
export const PATCH = withAuth<Params>(async (req, user, { credentialId }) => {
  const body = renamePasskeySchema.parse(await req.json());

  const result = await prisma.authenticator.updateMany({
    where: { credentialID: credentialId, userId: user.id },
    data: { name: body.name },
  });

  if (result.count === 0) {
    throw new HttpError(404, "Passkey not found");
  }

  log.info("user:passkey:rename:ok", { userId: user.id, credentialId, name: body.name });

  return new Response(null, { status: 204 });
});

/** Same scoping as PATCH. The account stays usable via other authenticators (OAuth, OTP) as long as ≥1 remains. */
export const DELETE = withAuth<Params>(async (req, user, { credentialId }) => {
  const result = await prisma.authenticator.deleteMany({
    where: { credentialID: credentialId, userId: user.id },
  });

  if (result.count === 0) {
    throw new HttpError(404, "Passkey not found");
  }

  log.info("user:passkey:delete:ok", { userId: user.id, credentialId });

  return new Response(null, { status: 204 });
});
