import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prefers `DATABASE_URL_UNPOOLED` for migrations because Neon's pooled URL is
 * fronted by PgBouncer (transaction pooling) and migrations need session-level
 * features (advisory locks, transactional DDL). Self-hosters off Neon leave
 * `DATABASE_URL_UNPOOLED` unset and the regular URL works directly.
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
