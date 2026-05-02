import { ONE_DAY_MS, SESSION_RETENTION_DAYS } from "@/lib/time";
import { prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Cron summary shape — inline schema because this response isn't
 * consumed by the api-client layer (Vercel Cron reads status codes
 * and the stdout log, not the JSON body). The parse still fires on
 * the server boundary so a shape drift (renamed counter, forgotten
 * field) surfaces in logs immediately instead of silently landing
 * in whatever observability surface we later wire this up to.
 */
const cronCleanupSummarySchema = z.object({
  invites: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  trackedUsers: z.number().int().nonnegative(),
  organizations: z.number().int().nonnegative(),
});

/**
 * `GET /api/cron/daily-cleanup` — nightly database hygiene (Vercel Cron).
 *
 * @remarks
 * Ordered steps, each potentially frees records for the next:
 *   1. Expired invites (PENDING/EXPIRED past TTL) — independent.
 *   2. Sessions older than {@link SESSION_RETENTION_DAYS} — cascades
 *      to Slices and Events via `onDelete: Cascade`.
 *   3. TrackedUsers with zero sessions — may become orphaned after
 *      step 2 clears their last session.
 *   4. Organizations with zero memberships. Cascades projects →
 *      sessions → tracked-users → events. Before deletion we null out
 *      any `User.activeOrganizationId` pointing to them (the schema
 *      does not declare `onDelete: SetNull` for that pointer, so
 *      Postgres would otherwise block the delete on referenced rows).
 *
 * Auth: caller sends `Authorization: Bearer $CRON_SECRET`. In dev/test
 * an unset `CRON_SECRET` opens the endpoint so it can be curl'd
 * manually. In production an unset `CRON_SECRET` denies every call
 * with 401 — a misconfigured deploy stays safe instead of exposing
 * cascading deletes to the public internet.
 *
 * `GET` because the canonical scheduler (Vercel Cron) issues HTTP GET;
 * destructive-on-GET is ugly but fighting that contract isn't worth a
 * wrapper. Self-hosters off Vercel point any scheduler at the same
 * endpoint with the same bearer header.
 *
 * @see vercel.json — default cron schedule definition.
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
