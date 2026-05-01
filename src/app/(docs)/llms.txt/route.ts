import { llms } from "fumadocs-core/source";

import { source } from "@/lib/source";

/**
 * `/llms.txt` — plain-text dump of the documentation, optimised for
 * LLM agents discovering the site.
 *
 * @remarks
 * Implements the [llms.txt convention](https://llmstxt.org/) — a
 * single text file at the apex containing every doc page's content,
 * structured so an AI agent can read the whole site in one fetch
 * without crawling the rendered HTML and parsing it back to text.
 *
 * Fumadocs ships the `llms` helper that walks the source tree and
 * emits the canonical format. We only need to expose it as a route.
 *
 * `revalidate = false` makes the response statically generatable on
 * Vercel — the content only changes when MDX source changes, so a
 * deploy-time render is exactly right.
 *
 * @see src/lib/source.ts — Fumadocs source consumed here.
 */
export const revalidate = false;

export function GET() {
  return new Response(llms(source).index(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
