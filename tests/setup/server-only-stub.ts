/**
 * Stub for the `server-only` package inside the test environment.
 *
 * @remarks
 * The real `server-only` module throws synchronously when imported from
 * anywhere other than a Next.js Server Component build target — it's a
 * compile-time guard that relies on Webpack/Turbopack substitution. In
 * Vite (which powers Vitest), the substitution never happens, so the
 * guard throws on every server-side SUT import.
 *
 * Replacing the specifier with this empty module via `vitest.config.ts`
 * `resolve.alias` keeps the guard in production code (Next.js still
 * substitutes correctly) while letting tests import the server-only
 * modules they're exercising.
 */
export {};
