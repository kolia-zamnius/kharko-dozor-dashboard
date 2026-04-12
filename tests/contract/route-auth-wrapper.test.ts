/**
 * Structural invariant: every `/api` route handler is wrapped in an auth
 * HOF (or is on the explicit exception list).
 *
 * @remarks
 * Replaces the per-route "returns 401 for anonymous" duplicate tests
 * with a single grep-style check. The per-route duplicates were
 * redundant because the 401 behaviour is already covered by the HOF
 * unit tests (`src/app/api/_lib/with-auth.test.ts`,
 * `with-public-key.test.ts`); the only regression they protected
 * against was "someone forgot to wrap the handler", which this single
 * test catches across ALL routes at once — including routes added in
 * the future.
 *
 * Exceptions are explicit, listed below with a one-line rationale. Any
 * future "authless" route must be added here deliberately (reviewable
 * in a PR diff) rather than slipping through unnoticed.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const API_ROOT = resolve(REPO_ROOT, "src/app/api");

/**
 * Substrings that signal an auth-guarded handler. `withAuth` gates the
 * dashboard surface; `withPublicKey` gates the SDK-facing surface
 * (`/api/ingest`, `/api/sessions/cancel`) and enforces CORS on the same
 * responses.
 */
const AUTH_WRAPPERS = ["withAuth", "withPublicKey"] as const;

/**
 * Routes intentionally exempt from the HOF requirement. Paths use
 * forward slashes (normalised before comparison) and are relative to
 * the repo root. Keep this list short and annotated — each entry is a
 * review-time decision, not a forget-to-fix.
 */
const EXCEPTIONS: ReadonlyArray<{ path: string; reason: string }> = [
  {
    path: "src/app/api/auth/[...nextauth]/route.ts",
    reason: "NextAuth catch-all — owns its own auth handling upstream.",
  },
  {
    path: "src/app/api/cron/daily-cleanup/route.ts",
    reason: "Bearer-token auth (Authorization: Bearer $CRON_SECRET) — intentionally NOT withAuth.",
  },
];

/**
 * Walks `src/app/api/**` collecting every `route.ts` (POSIX-normalised
 * paths relative to the repo root). Uses native `readdir` recursion —
 * `fs.promises.glob` lands in Node 22, and the project targets Node 20+.
 */
async function findRouteFiles(): Promise<string[]> {
  const entries = await readdir(API_ROOT, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name === "route.ts")
    .map((e) => {
      const absolute = join(e.parentPath ?? (e as unknown as { path: string }).path, e.name);
      return relative(REPO_ROOT, absolute).split(sep).join("/");
    })
    .sort();
}

describe("route-auth-wrapper invariant", () => {
  it("every /api route imports an auth wrapper (or is explicitly exempt)", async () => {
    const files = await findRouteFiles();

    // Sanity — the walker must find something. A silent zero-result
    // would make this whole test a no-op.
    expect(files.length).toBeGreaterThan(10);

    const exemptPaths = new Set(EXCEPTIONS.map((e) => e.path));
    const violators: string[] = [];

    for (const file of files) {
      if (exemptPaths.has(file)) continue;
      const contents = await readFile(resolve(REPO_ROOT, file), "utf8");
      const hasWrapper = AUTH_WRAPPERS.some((w) => contents.includes(w));
      if (!hasWrapper) violators.push(file);
    }

    expect(violators).toEqual([]);
  });

  it("every exception is still present (stale-exception guard)", async () => {
    // If an exception file was renamed or deleted, the exception entry
    // becomes dead config that would silently allow a future
    // same-named route to bypass the check. Fail loudly when that
    // happens so the EXCEPTIONS list stays honest.
    for (const { path } of EXCEPTIONS) {
      const contents = await readFile(resolve(REPO_ROOT, path), "utf8").catch(() => null);
      expect(contents, `Exception ${path} no longer exists — update EXCEPTIONS`).not.toBeNull();
    }
  });
});
