import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI config — used by `prisma migrate`, `prisma db push`, etc.
 *
 * @remarks
 * Migrations need session-level Postgres features (advisory locks,
 * transactional DDL across statements) that don't survive PgBouncer's
 * transaction-pooling mode. On Neon, the regular `DATABASE_URL` is
 * pooler-fronted, so a separate **unpooled** URL is required for the
 * migrator. On every other host (RDS, Supabase, Docker, self-managed
 * Postgres) the regular `DATABASE_URL` is already a direct TCP
 * connection that supports session-level features — no second URL
 * needed.
 *
 * Hence the fallback: prefer `DATABASE_URL_UNPOOLED` if set, otherwise
 * use `DATABASE_URL`. Self-hosters off Neon can leave
 * `DATABASE_URL_UNPOOLED` unset and migrations still work.
 *
 * @see src/server/db/client.ts — runtime Prisma client (uses the
 *   pooled `DATABASE_URL` via the Neon adapter).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
