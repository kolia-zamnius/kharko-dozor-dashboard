/**
 * Vitest global setup — runs once per test run, before any test file loads.
 *
 * @remarks
 * Responsibilities:
 *   1. Boot a Postgres 17 container via Testcontainers (GitHub Actions
 *      `ubuntu-latest` ships with Docker preinstalled, so this works in
 *      CI without extra YAML).
 *   2. Create the `template_test` database inside it.
 *   3. Push the Prisma schema to that template via `prisma db push`.
 *   4. Export host/port/creds + template-DB name to `process.env` so
 *      `tests/helpers/db.ts` can clone a fresh DB per worker.
 *
 * The returned `teardown` stops the container. Runs even if test
 * execution fails — Testcontainers also has Ryuk as a safety net in
 * case the Node process hard-crashes.
 *
 * @see tests/helpers/db.ts — per-worker DB clone + Prisma client.
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

  // Create the template DB. We talk to `postgres` (the admin DB) because
  // you can't `CREATE DATABASE` while connected to the target.
  const { Client } = await import("pg");
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${TEMPLATE_DB}"`);
  } finally {
    await admin.end();
  }

  // Push the Prisma schema into the template. `prisma.config.ts` reads
  // DATABASE_URL_UNPOOLED for the datasource, so that's what we set
  // for the child process. Prisma 7 dropped the legacy `--skip-generate`
  // flag from the `db push` CLI surface — running the default command
  // re-generates the client against the template DB, which is cheap
  // (~1-2s) since the generator already has its artefacts cached from
  // `npm install`'s postinstall hook.
  console.log("[testcontainers] pushing schema to template…");
  const push = spawnSync("npx", ["prisma", "db", "push", "--accept-data-loss"], {
    env: { ...process.env, DATABASE_URL_UNPOOLED: templateUrl },
    stdio: "inherit",
  });
  if (push.status !== 0) {
    await container.stop();
    throw new Error("[testcontainers] `prisma db push` failed — see output above");
  }

  // Expose to workers. Vitest's fork-pool inherits `process.env` from the
  // main process, so these reach every test file.
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
