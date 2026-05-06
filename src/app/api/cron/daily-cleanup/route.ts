import { ONE_DAY_MS, SESSION_RETENTION_DAYS } from "@/lib/time";
import { prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Inline — Vercel Cron reads status codes + stdout, not the JSON body, so
 * api-client doesn't need this. The parse still runs as a drift sentinel.
 */
const cronCleanupSummarySchema = z.object({
  invites: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  trackedUsers: z.number().int().nonnegative(),
  organizations: z.number().int().nonnegative(),
});

/**
 * Ordered steps — each frees records for the next:
 *   1. Invites past TTL (PENDING/EXPIRED).
 *   2. Sessions older than `SESSION_RETENTION_DAYS` (cascades EventBatches + Markers).
 *   3. TrackedUsers with zero sessions (orphans after step 2).
 *   4. Memberless orgs. Active-org pointers MUST be nulled FIRST — schema
 *      doesn't declare `onDelete: SetNull` for `User.activeOrganizationId`,
 *      so Postgres would block the delete on referenced rows.
 *
 * Auth — Bearer matches `CRON_SECRET`. Prod with unset secret denies every
 * call (misconfigured deploy stays safe); dev/test with unset secret opens
 * the endpoint for curl.
 *
 * `GET` because Vercel Cron issues GET — destructive-on-GET is ugly but
 * fighting the contract isn't worth a wrapper.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" && !env.CRON_SECRET) {
    log.warn("cron:cleanup:unauthorized:secret_unconfigured");
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      log.warn("cron:cleanup:unauthorized", { hasHeader: Boolean(auth) });
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  log.info("cron:cleanup:start");

  const now = new Date();
  const sessionCutoff = new Date(now.getTime() - SESSION_RETENTION_DAYS * ONE_DAY_MS);

  const invites = await prisma.invite.deleteMany({
    where: {
      expiresAt: { lt: now },
      status: { in: ["PENDING", "EXPIRED"] },
    },
  });

  const sessions = await prisma.session.deleteMany({
    where: { createdAt: { lt: sessionCutoff } },
  });

  const trackedUsers = await prisma.trackedUser.deleteMany({
    where: { sessions: { none: {} } },
  });

  const emptyOrgs = await prisma.organization.findMany({
    where: { memberships: { none: {} } },
    select: { id: true },
  });
  const emptyOrgIds = emptyOrgs.map((o) => o.id);

  let orgsDeleted = 0;
  if (emptyOrgIds.length > 0) {
    await prisma.user.updateMany({
      where: { activeOrganizationId: { in: emptyOrgIds } },
      data: { activeOrganizationId: null },
    });
    const result = await prisma.organization.deleteMany({
      where: { id: { in: emptyOrgIds } },
    });
    orgsDeleted = result.count;
  }

  const summary = cronCleanupSummarySchema.parse({
    invites: invites.count,
    sessions: sessions.count,
    trackedUsers: trackedUsers.count,
    organizations: orgsDeleted,
  });

  log.info("cron:cleanup:summary", { summary });

  return NextResponse.json(summary);
}
