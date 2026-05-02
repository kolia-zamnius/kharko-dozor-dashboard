import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { source } from "@/lib/source";
import { APIPage } from "./openapi";

/**
 * MDX components map — Fumadocs defaults plus the OpenAPI page renderer.
 *
 * @remarks
 * `<APIPage>` is bound to the repo's committed `openapi.snapshot.json`
 * via the page-local `./openapi.ts`. MDX files under `_content/api/` reference
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
 * Params signature matches the rest of the project (explicit
 * `Promise<{...}>` shape rather than Next.js 16's auto-generated
 * `PageProps<>` global) — lets `tsc --noEmit` run in CI without first
 * running `next typegen` to populate `.next/types/`.
 *
 * @see next.config.ts — `/documentation` redirect.
 * @see src/app/(docs)/documentation/not-found.tsx — fallback for
 *   genuinely unknown slugs.
 */
type DocumentationPageProps = {
  params: Promise<{ slug: string[] }>;
};

export default async function DocumentationPage({ params }: DocumentationPageProps) {
  const { slug } = await params;
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

export async function generateMetadata({ params }: DocumentationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) return {};

  return {
    title: `${page.data.title} — Dozor`,
    description: page.data.description,
  };
}
