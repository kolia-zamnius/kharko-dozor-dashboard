import { defineDocs, defineConfig } from "fumadocs-mdx/config";

/**
 * Fumadocs MDX content registry.
 *
 * @remarks
 * Single docs collection rooted at `src/app/(docs)/documentation/_content`
 * — colocated with the route that renders it (`src/app/(docs)/documentation/`)
 * per the project's "page-specific assets live next to the page" rule. The
 * `_` prefix on `_content` opts the directory out of Next.js route
 * resolution so a stray `page.tsx` inside the tree can never accidentally
 * become a real URL.
 *
 * The Fumadocs CLI (`fumadocs-mdx`) reads this file to generate the
 * `.source/` codegen at the repo root — that folder is gitignored and
 * is what `src/lib/source.ts` consumes.
 *
 * @see src/lib/source.ts — runtime source loader fed by this config.
 * @see src/app/(docs)/documentation/[...slug]/page.tsx — the renderer.
 */
export const docs = defineDocs({
  dir: "src/app/(docs)/documentation/_content",
});

export default defineConfig();
