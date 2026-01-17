/**
 * Prisma client singleton backed by the Neon serverless driver adapter.
 *
 * @remarks
 * Two concerns stacked in one small module:
 *
 *   1. **Neon adapter** — we talk to Postgres via `@neondatabase/serverless`
 *      over HTTP/WebSockets instead of TCP. That's what lets the same
 *      client code run in Node (route handlers, crons) and in the
 *      Edge runtime without a second data access path. Because the
 *      adapter owns the connection string, `prisma/schema.prisma` has
 *      **no** `url` field — it's provided here at runtime.
 *
 *   2. **Dev-only global cache** — Next.js hot-reloads module scope on
 *      every save, which would leak a fresh `PrismaClient` (and a
 *      fresh connection pool) per file save without this guard. In
 *      production we never hot-reload, so we let the module scope own
 *      the singleton directly.
 *
 * @see src/server/env.ts — validated `DATABASE_URL` used by the adapter.
 */

import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
