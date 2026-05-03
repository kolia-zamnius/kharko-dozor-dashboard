import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

/**
 * Fumadocs's `<RootProvider>` Cmd-K search hits this URL. Indexes the same
 * `source` tree that renders `/documentation/*` — new MDX is searchable next
 * deploy. Auth-less by design (echoes already-published content); whitelisted
 * in `route-auth-wrapper.test.ts`.
 */
export const { GET } = createFromSource(source);
