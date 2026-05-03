/**
 * Single grep-style invariant replacing per-route "returns 401 for anonymous"
 * duplicates — the 401 behaviour is already covered by HOF unit tests; the only
 * regression worth catching is "someone forgot to wrap the handler", and this
 * catches it across every current and future route at once.
 *
 * EXCEPTIONS are reviewed in PR diffs — adding one is a deliberate decision,
 * not a forget-to-fix.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const API_ROOT = resolve(REPO_ROOT, "src/app/api");

/** `withAuth` gates the dashboard surface; `withPublicKey` gates the SDK surface (CORS-aware). */
const AUTH_WRAPPERS = ["withAuth", "withPublicKey"] as const;

const EXCEPTIONS: ReadonlyArray<{ path: string; reason: string }> = [
  {
    path: "src/app/api/auth/[...nextauth]/route.ts",
    reason: "NextAuth catch-all — owns its own auth handling upstream.",
  },
  {
    path: "src/app/api/cron/daily-cleanup/route.ts",
    reason: "Bearer-token auth (Authorization: Bearer $CRON_SECRET) — intentionally NOT withAuth.",
  },
  {
    path: "src/app/api/search/route.ts",
    reason: "Fumadocs docs search — public surface, only echoes published /documentation content.",
  },
];

/** Native `readdir` recursion — `fs.promises.glob` lands in Node 22, project targets Node 20+. */
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

    // Sanity — silent zero-result would turn the whole test into a no-op.
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
    // A renamed/deleted exception target would let a same-named future route
    // bypass the check silently — fail loudly so EXCEPTIONS stays honest.
    for (const { path } of EXCEPTIONS) {
      const contents = await readFile(resolve(REPO_ROOT, path), "utf8").catch(() => null);
      expect(contents, `Exception ${path} no longer exists — update EXCEPTIONS`).not.toBeNull();
    }
  });
});
