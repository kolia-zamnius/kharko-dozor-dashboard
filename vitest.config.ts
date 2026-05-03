import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const here = dirname(fileURLToPath(import.meta.url));
const sharedSetupFiles = ["./tests/setup/load-env.ts", "./tests/setup/vitest.setup.ts"];

// Auth / prisma / next-intl auto-mocks scoped here — unit + contract projects don't see them.
const integrationSetupFiles = [...sharedSetupFiles, "./tests/setup/integration-mocks.ts"];

// `server-only` throws outside a Next.js Server Component build; alias to a stub for Vite.
// Production builds still see the real package and honour the guard.
const serverOnlyAlias = {
  "server-only": resolve(here, "tests/setup/server-only-stub.ts"),
};

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: serverOnlyAlias },
  test: {
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
          globalSetup: ["./tests/setup/global-setup.ts"],
          // Testcontainers cold start (~20s first run) bumps the per-test budget.
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
      // NextAuth catch-all excluded — tested upstream; our callbacks + adapter run via integration flows.
      exclude: ["**/*.test.ts", "**/*.d.ts", "src/generated/**", "src/app/api/auth/**"],
    },
  },
});
