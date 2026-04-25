import "server-only";
import { orgAvatarUrl } from "@/lib/avatar";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";
import type { NextAuthConfig } from "next-auth";
import { randomUUID } from "node:crypto";

/**
 * Auth.js event handlers — fired AFTER the corresponding mutation. Unlike
 * callbacks, events cannot block sign-in or alter the response; their
 * return value is ignored. Use them for "fire-and-forget" provisioning.
 *
 * `createUser` is the only one we currently handle: it provisions a
 * Personal Space organization for every new user, ensuring the active-org
 * resolver in the JWT callback always has a valid fallback. Idempotent —
 * if a Personal Space already exists (e.g. a previous failed sign-up
 * retried), we early-return rather than creating a duplicate.
 */
export const authEvents: NextAuthConfig["events"] = {
  async createUser({ user }) {
    const userId = user.id;
    if (!userId) return;

    const existing = await prisma.organization.findFirst({
      where: { createdById: userId, type: "PERSONAL" },
    });
    if (existing) {
      log.debug("auth:create_user:personal_space_exists", { userId });
      return;
    }

    const personalOrg = await prisma.organization.create({
      data: {
        name: "Personal Space",
        type: "PERSONAL",
        image: orgAvatarUrl(randomUUID()),
        createdById: userId,
        memberships: {
          create: { userId, role: "OWNER" },
        },
      },
    });

    log.info("auth:create_user:ok", {
      userId,
      personalOrgId: personalOrg.id,
      email: user.email ?? null,
    });
  },
};
