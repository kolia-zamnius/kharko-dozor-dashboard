import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { MIN_REAL_SESSION_DURATION_SECONDS, MIN_REAL_SESSION_EVENTS } from "@/lib/time";

/**
 * Prisma `where` fragment — spread into any `prisma.session.{findMany,count,...}`
 * call alongside other filters. Keeping the floor in a single helper means a
 * future bump to `MIN_REAL_SESSION_*` ripples through every list, count, and
 * aggregate without grep-and-replace.
 */
export const REAL_SESSION_FILTER = {
  eventCount: { gte: MIN_REAL_SESSION_EVENTS },
  duration: { gte: MIN_REAL_SESSION_DURATION_SECONDS },
} as const satisfies Prisma.SessionWhereInput;

/**
 * Same floor as a `Prisma.sql` fragment for raw queries that already JOIN `Session`
 * under an alias. Pass the alias used in the query (e.g. `s` for `FROM "Session" s`).
 */
export function realSessionSql(alias: string): Prisma.Sql {
  return Prisma.sql`${Prisma.raw(`"${alias}"`)}."eventCount" >= ${MIN_REAL_SESSION_EVENTS} AND ${Prisma.raw(`"${alias}"`)}.duration >= ${MIN_REAL_SESSION_DURATION_SECONDS}`;
}
