import { loader } from "fumadocs-core/source";

import { docs } from "../../.source/server";

/**
 * Single Fumadocs source for `/documentation`. `baseUrl` decouples URL from content
 * location: pages live under `src/app/(docs)/documentation/_content/` (`_` prefix
 * opts the dir out of routing) but render at `/documentation/<slug>`. Both
 * `[...slug]/page.tsx` and the layout consume the exported `source` from here.
 * `.source/` is gitignored — Fumadocs MDX plugin regenerates it on each
 * `next dev` / `next build`.
 */
export const source = loader({
  baseUrl: "/documentation",
  source: docs.toFumadocsSource(),
});
