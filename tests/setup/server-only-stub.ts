/**
 * Aliased in `vitest.config.ts::resolve.alias` for the `server-only` specifier.
 * The real package throws synchronously unless Webpack/Turbopack swaps it in a
 * Server Component build — Vite never does that swap, so the guard would trip
 * on every server-side SUT import. Production builds still see the real package.
 */
export {};
