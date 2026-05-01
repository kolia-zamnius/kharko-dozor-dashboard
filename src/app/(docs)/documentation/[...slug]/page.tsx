import { notFound } from "next/navigation";

import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { APIPage } from "@/lib/openapi";
import { source } from "@/lib/source";

/**
 * MDX components map — Fumadocs defaults plus the OpenAPI page renderer.
 *
 * @remarks
 * `<APIPage>` is bound to the repo's committed `openapi.snapshot.json`
 * via `src/lib/openapi.ts`. MDX files under `_content/api/` reference
 * operations as `<APIPage operations={[{ path, method }]} />` and
 * Fumadocs renders the full request/response detail straight from
 * the spec. Editing the spec is a JSON edit; editing the docs is an
 * MDX file rearrangement — neither leaks across.
 */
const mdxComponents = {
  ...defaultMdxComponents,
  APIPage,
};

/**
 * Documentation page — single renderer that handles every
 * `/documentation/<...>` URL by resolving the slug against the Fumadocs
 * source tree.
 *
 * @remarks
 * Required catch-all (`[...slug]`, not `[[...slug]]`): bare
 * `/documentation` deliberately doesn't match here so the
 * `next.config.ts` redirect rule fires and sends the visitor to
 * `/documentation/introduction`. That keeps the "what is
 * the docs landing" decision in one place (next.config) instead of
 * branching inside this component on `slug?.length === 0`.
 *
 * Uses Next.js's auto-generated `PageProps<>` typed props so the
 * params signature stays in sync with the route segment shape — and
 * Next.js's instrumentation can resolve component names cleanly
 * (older inline `Promise<{ slug: string[] }>` shape was suspected of
 * tripping a `Performance.measure` negative-timestamp dev warning).
 *
 * @see next.config.ts — `/documentation` redirect.
 * @see src/app/(docs)/documentation/not-found.tsx — fallback for
 *   genuinely unknown slugs.
 */
export default async function DocumentationPage(
  props: PageProps<"/documentation/[...slug]">,
) {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={mdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<"/documentation/[...slug]">) {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) return {};

  return {
    title: `${page.data.title} — Dozor`,
    description: page.data.description,
  };
}
