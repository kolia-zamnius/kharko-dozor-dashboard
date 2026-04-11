/**
 * Per-worker test database helper.
 *
 * @remarks
 * Each Vitest worker calls `getTestPrisma()` once and caches the result in
 * module scope. On first call the helper:
 *
 *   1. Reads host/port/template-db from env (set by `global-setup.ts`).
 *   2. Connects to the admin `postgres` DB and runs
 *      `DROP DATABASE IF EXISTS worker_N; CREATE DATABASE worker_N TEMPLATE template_test`.
 *      Cloning a pre-migrated template is ~50ms per worker vs ~3s for a
 *      fresh `prisma db push`.
 *   3. Instantiates a `PrismaClient` bound to `worker_N` via
 *      `@prisma/adapter-pg` (the tests path; prod uses `@prisma/adapter-neon`).
 *
 * `truncateAll(prisma)` wipes user-owned tables between tests — cheaper
 * than re-cloning a DB, and preserves the schema + `_prisma_migrations`
 * marker rows. Integration test files wire it into their `beforeEach`
 * explicitly; unit tests never touch it.
 *
 * @see tests/setup/global-setup.ts — spins up the shared container +
 *   template DB.
 */

import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

let cached: PrismaClient | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Test DB env var "${name}" is not set — did \`tests/setup/global-setup.ts\` run? ` +
        `If you're running a single file with \`vitest run path/to.test.ts\`, make sure ` +
        `globalSetup is still wired.`,
    );
  }
  return value;
}

function workerId(): string {
  // Vitest 3 injects VITEST_POOL_ID per worker (1-based, string). Fall back
  // to the pid so `vitest run <single-file>` in a weird local setup still
  // produces a unique DB name.
  return process.env.VITEST_POOL_ID ?? String(process.pid);
}

type Urls = {
  adminUrl: string;
  workerUrl: string;
  workerDb: string;
  templateDb: string;
};

function buildUrls(): Urls {
  const host = requireEnv("TEST_POSTGRES_HOST");
  const port = requireEnv("TEST_POSTGRES_PORT");
  const user = requireEnv("TEST_POSTGRES_USER");
  const password = requireEnv("TEST_POSTGRES_PASSWORD");
  const templateDb = requireEnv("TEST_POSTGRES_TEMPLATE_DB");
  const workerDb = `worker_${workerId()}`;
  const auth = `${user}:${password}`;
  const endpoint = `${host}:${port}`;
  return {
    adminUrl: `postgresql://${auth}@${endpoint}/postgres`,
    workerUrl: `postgresql://${auth}@${endpoint}/${workerDb}`,
    workerDb,
    templateDb,
  };
}

/**
 * Returns the worker-scoped Prisma client, creating the worker DB on first
 * call. Safe to call repeatedly — subsequent calls return the cached
 * client without touching the admin DB.
 */
export async function getTestPrisma(): Promise<PrismaClient> {
  if (cached) return cached;

  const { adminUrl, workerUrl, workerDb, templateDb } = buildUrls();

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    // Kill any stale connections to `workerDb` left by a previous crashed
    // run — otherwise DROP DATABASE fails with "database is being accessed
    // by other users".
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [workerDb],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${workerDb}"`);
    await admin.query(`CREATE DATABASE "${workerDb}" TEMPLATE "${templateDb}"`);
  } finally {
    await admin.end();
  }

  const adapter = new PrismaPg({ connectionString: workerUrl });
  cached = new PrismaClient({ adapter });
  return cached;
}

/**
 * TRUNCATE every user-owned table in the `public` schema.
 *
 * @remarks
 * `RESTART IDENTITY` resets any serial sequences (none in our schema
 * today — all ids are cuid-strings — but costless to keep). `CASCADE`
 * lets PG handle FK order so we don't maintain a dependency-sorted
 * table list by hand.
 *
 * Intentionally introspects `pg_tables` rather than hardcoding the list:
 * adding a Prisma model becomes a zero-diff change for this helper.
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (rows.length === 0) return;
  const quoted = rows.map((r) => `"${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE`);
}
