import "server-only";
import { userAvatarUrl } from "@/lib/avatar";
import { prisma } from "@/server/db/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

/**
 * `PrismaAdapter` with two `createUser` overrides: pop the `pending_name` cookie
 * (the sign-up server action stashes the user-entered name before redirecting to
 * OTP entry — Nodemailer doesn't carry a name field through), and assign a
 * DiceBear avatar from a fresh UUID. OAuth `image` is deliberately ignored so
 * every user has a consistent visual style without depending on third-party CDNs.
 */
export function createAuthAdapter(): Adapter {
  return {
    ...PrismaAdapter(prisma),
    // Drop the adapter-supplied `id` — Prisma generates a cuid.
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
