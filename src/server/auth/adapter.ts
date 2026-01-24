import "server-only";
import { userAvatarUrl } from "@/lib/avatar";
import { prisma } from "@/server/db/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

/**
 * Auth.js adapter — Prisma adapter with two overrides on `createUser`:
 *
 *   1. **Pending-name cookie**: the sign-up server action stores the
 *      user-entered display name in a short-lived cookie before redirecting
 *      to OTP entry. Auth.js then calls `createUser` with `data.name = null`
 *      (the Nodemailer OTP provider doesn't carry a name). We pop the
 *      cookie here so the new row gets the user's chosen name on the first
 *      write — no follow-up `update` needed.
 *
 *   2. **DiceBear avatar**: every user gets a deterministic avatar based on
 *      a fresh UUID. We deliberately ignore OAuth `image` (Google/GitHub)
 *      so the dashboard has a consistent visual style and we don't depend
 *      on third-party CDNs.
 *
 * The base `PrismaAdapter` is composed via spread, so all other adapter
 * methods (sessions, accounts, verification tokens) come from it unchanged.
 */
export function createAuthAdapter(): Adapter {
  return {
    ...PrismaAdapter(prisma),
    // Drop the adapter-supplied `id` — Prisma generates one via cuid.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    createUser: async ({ id, ...data }) => {
      const cookieStore = await cookies();
      const pendingName = cookieStore.get("pending_name")?.value;
      if (pendingName) cookieStore.delete("pending_name");

      return prisma.user.create({
        data: {
          ...data,
          name: pendingName || data.name || null,
          image: userAvatarUrl(randomUUID()),
        },
      });
    },
  };
}
