import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint baseline = Next.js + TypeScript presets + three type-aware
 * rules that catch whole classes of bugs the base preset misses:
 *
 *   - `consistent-type-imports` — force `import type` for type-only
 *     imports so the bundler can drop them and intent is explicit.
 *   - `no-floating-promises` — any promise that isn't `await`ed,
 *     `.catch`-handled, or prefixed with `void` is a bug waiting for
 *     a production incident.
 *   - `switch-exhaustiveness-check` — compile-time exhaustiveness on
 *     discriminated unions without needing an `assertNever` at every
 *     `switch` site.
 *
 * All three need the TS program, so we scope a `languageOptions` block
 * with `parserOptions.project: true` to TS/TSX files. `src/generated/`
 * is excluded because it's Prisma output we don't hand-maintain.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**", ".source/**"]),
]);

export default eslintConfig;
