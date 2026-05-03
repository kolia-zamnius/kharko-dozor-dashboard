/**
 * Boots one Postgres 17 container for the whole test run, creates `template_test`
 * inside it, pushes the Prisma schema, and exports `TEST_POSTGRES_*` so per-worker
 * clones in {@link tests/helpers/db.ts} can spin up fresh DBs.
 *
 * `prisma db push` (not `migrate deploy`) is intentional — the template DB is
 * throwaway, so migration history would be dead weight (CLAUDE.md confirms).
 */

import { spawnSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

const TEMPLATE_DB = "template_test";
const POSTGRES_IMAGE = "postgres:17-alpine";

let container: StartedPostgreSqlContainer | undefined;

export async function setup(): Promise<void> {
  console.log(`[testcontainers] booting ${POSTGRES_IMAGE}…`);
  container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase("postgres")
    .withUsername("test")
    .withPassword("test")
    .start();

  const host = container.getHost();
  const port = container.getPort();
  const adminUrl = `postgresql://test:test@${host}:${port}/postgres`;
  const templateUrl = `postgresql://test:test@${host}:${port}/${TEMPLATE_DB}`;

  // Connect to admin DB — `CREATE DATABASE` can't run while connected to the target.
  const { Client } = await import("pg");
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${TEMPLATE_DB}"`);
  } finally {
    await admin.end();
  }

  // Prisma 7 dropped `--skip-generate` from `db push`, so the client gets
  // re-generated against the template (~1-2s, generator artefacts are cached).
  console.log("[testcontainers] pushing schema to template…");
  const push = spawnSync("npx", ["prisma", "db", "push", "--accept-data-loss"], {
    env: { ...process.env, DATABASE_URL_UNPOOLED: templateUrl },
    stdio: "inherit",
  });
  if (push.status !== 0) {
    await container.stop();
    throw new Error("[testcontainers] `prisma db push` failed — see output above");
  }

  // Vitest's fork-pool inherits `process.env` from the main process, so workers
  // pick these up without extra plumbing.
  process.env.TEST_POSTGRES_HOST = host;
  process.env.TEST_POSTGRES_PORT = String(port);
  process.env.TEST_POSTGRES_USER = "test";
  process.env.TEST_POSTGRES_PASSWORD = "test";
  process.env.TEST_POSTGRES_TEMPLATE_DB = TEMPLATE_DB;

  console.log("[testcontainers] ready.");
}

export async function teardown(): Promise<void> {
  if (container) {
    console.log("[testcontainers] stopping…");
    await container.stop();
  }
}
