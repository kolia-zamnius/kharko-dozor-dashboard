/**
 * Vitest root configuration.
 *
 * @remarks
 * Backend-only test suite — no React Testing Library, no jsdom. Split into
 * two Vitest **projects** so unit tests don't pay for Testcontainers boot:
 *
 *   - `unit` — colocated `src/*.test.ts`. No DB, no global setup.
 *     Runs on every `npm run test:unit` without Docker. Fast (<5s).
 *   - `integration` — `tests/integration/` + `tests/contract/`. Boots
 *     Postgres 17 via Testcontainers in `global-setup.ts`. Requires
 *     Docker (OrbStack / Docker Desktop on macOS).
 *
 * `npm run test` runs both projects serially — the unit suite reports
 * first for fast feedback, then integration. Each project owns its own
 * include/setup so neither leaks setup files into the other.
 *
 * The Next.js docs recommend `vite-tsconfig-paths` for `@/*` path-alias
 * resolution. The plugin reads `tsconfig.json` directly, so there's no
 * second source of truth to maintain.
 *
 * `pool: "forks"` (Vitest 3 default) gives each worker an isolated Node
 * process — required for the per-worker DB clone pattern in
 * `tests/helpers/db.ts` and for module mocks not leaking across files.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const here = dirname(fileURLToPath(import.meta.url));
const sharedSetupFiles = ["./tests/setup/load-env.ts", "./tests/setup/vitest.setup.ts"];

// Integration tests inherit the shared setup AND install the three
// `vi.mock` calls (auth / prisma / next-intl) from `integration-mocks.ts`
// — scoped here so unit + contract projects don't pick up the auto-mocks.
const integrationSetupFiles = [...sharedSetupFiles, "./tests/setup/integration-mocks.ts"];

// Alias `server-only` to an empty module inside the test environment.
// The real package throws when imported from anywhere that isn't a
// Next.js Server Component build — Vite is not, so every SUT import
// of a server-only module would fail without this stub. Production
// Next.js builds still see the real `server-only` and honour the guard.
const serverOnlyAlias = {
  "server-only": resolve(here, "tests/setup/server-only-stub.ts"),
};

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: serverOnlyAlias },
  test: {
    // `verbose` reporter prints every `it(...)` name instead of
    // collapsing to `✓ file.test.ts (N tests)`. Trade-off is a longer
    // transcript, which is exactly what we want locally ("what did this
    // suite actually assert?"). CI picks it up too — GitHub Actions
    // logs are scrollable and searchable, and when a flake surfaces in
    // CI the verbose history tells the on-call reviewer which specific
    // case blew up without re-running.
    reporters: process.env.CI ? ["verbose", "github-actions"] : ["verbose"],
    projects: [
      {
        plugins: [tsconfigPaths()],
        resolve: { alias: serverOnlyAlias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          setupFiles: sharedSetupFiles,
        },
      },
      {
        // Contract project — OpenAPI snapshot + any other cross-cutting
        // schema tests that read production zod but need no DB. Runs
        // without Docker, no globalSetup — suitable for CI smoke and
        // for contributors who want to verify a schema change before
        // touching the integration harness.
        plugins: [tsconfigPaths()],
        resolve: { alias: serverOnlyAlias },
        test: {
          name: "contract",
          environment: "node",
          include: ["tests/contract/**/*.test.ts"],
          setupFiles: sharedSetupFiles,
        },
      },
      {
        plugins: [tsconfigPaths()],
        resolve: { alias: serverOnlyAlias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: integrationSetupFiles,
          // Only the integration project boots Postgres — the unit project
          // runs without Docker on any contributor machine.
          globalSetup: ["./tests/setup/global-setup.ts"],
          // Testcontainers cold start (image pull + Postgres readiness +
          // `prisma db push`) takes ~20s the first time; the per-test
          // budget bumps to match.
          testTimeout: 30_000,
          hookTimeout: 120_000,
          pool: "forks",
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**", "src/api-client/**", "src/app/api/**", "src/server/**"],
      // Exclude: test files themselves, ambient/generated code, and the
      // NextAuth catch-all route (tested upstream — we test our callbacks
      // + adapter via integration flows instead).
      exclude: ["**/*.test.ts", "**/*.d.ts", "src/generated/**", "src/app/api/auth/**"],
    },
  },
});
