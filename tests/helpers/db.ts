/**
 * Per-worker test DB. First call to `getTestPrisma()` clones `template_test`
 * (created in `global-setup.ts`) into `worker_${VITEST_POOL_ID}` — ~50ms vs
 * ~3s for a fresh `prisma db push`. Tests use `@prisma/adapter-pg`; prod uses
 * `@prisma/adapter-neon` (see CLAUDE.md "Stack").
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
  // Fallback to pid keeps unique DB names if a quirky local setup runs without
  // VITEST_POOL_ID (e.g. someone wires `vitest run` from a script).
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

export async function getTestPrisma(): Promise<PrismaClient> {
  if (cached) return cached;

  const { adminUrl, workerUrl, workerDb, templateDb } = buildUrls();

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    // Stale connections from a crashed previous run would make DROP DATABASE
    // fail with "database is being accessed by other users".
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
 * Introspects `pg_tables` instead of hardcoding a list — adding a Prisma model
 * is a zero-diff change here. `CASCADE` lets PG handle FK order.
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
