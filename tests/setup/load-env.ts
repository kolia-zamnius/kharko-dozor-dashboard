/**
 * Load `.env.test` into `process.env` before anything else.
 *
 * @remarks
 * Runs as the first entry in `vitest.config.ts::test.setupFiles` so that
 * `@/server/env` (which zod-parses on module load) sees a valid env by the
 * time any test file imports anything server-side.
 *
 * `override: false` means a real env var wins over the committed `.env.test`
 * default — useful in CI where DATABASE_URL might be injected from a secret,
 * or when a dev sets `DATABASE_URL=…` inline for a one-off debug run.
 *
 * The actual test DATABASE_URL is re-written at runtime by `global-setup.ts`
 * once Testcontainers has a Postgres instance up. The `.env.test` placeholder
 * only exists to pass zod validation at static import time.
 */

import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

// `quiet: true` silences dotenv 17's built-in "tip" advertisements
// (`◇ injected env (7) from .env.test // tip: ⌘ …`). Useful tips for
// first-time users; pure log pollution when every one of our 27 test
// files boots the loader.
config({ path: resolve(root, ".env.test"), override: false, quiet: true });
