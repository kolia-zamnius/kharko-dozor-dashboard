/**
 * First entry in `vitest.config.ts::test.setupFiles` — `@/server/env` zod-parses
 * at module load, so the env must be hydrated before any server-side import fires.
 *
 * `override: false` lets a real env var (CI secret, inline `DATABASE_URL=…` debug)
 * win over the committed `.env.test`. The placeholder DATABASE_URL is overwritten
 * at runtime by `global-setup.ts` once Testcontainers is up.
 */

import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

// `quiet: true` silences dotenv 17's "tip" advertisements on every file boot.
config({ path: resolve(root, ".env.test"), override: false, quiet: true });
