import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

/**
 * `GET /api/search?q=...` — Fumadocs docs search endpoint.
 *
 * @remarks
 * Fumadocs's `<RootProvider>` calls this URL by default for the docs
 * zone search box (Cmd-K). Indexes the same `source` tree that powers
 * `/documentation/*` rendering, so adding a new MDX file makes it
 * searchable on next deploy without a separate index step.
 *
 * Intentionally no auth: docs are a public surface, and the search
 * payload only echoes content that's already published at
 * `/documentation/*`. Whitelisted in `tests/contract/route-auth-wrapper.test.ts`
 * with a matching exception entry.
 */
export const { GET } = createFromSource(source);
