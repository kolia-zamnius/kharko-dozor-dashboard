import { llms } from "fumadocs-core/source";

import { source } from "@/lib/source";

/**
 * llms.txt convention (llmstxt.org) — single text file so an agent reads the
 * whole site in one fetch. `revalidate: false` makes it statically generated;
 * content only changes when MDX source changes (i.e. deploy time).
 */
export const revalidate = false;

export function GET() {
  return new Response(llms(source).index(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
