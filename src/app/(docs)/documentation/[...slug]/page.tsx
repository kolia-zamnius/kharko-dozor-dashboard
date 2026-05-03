import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { source } from "@/lib/source";
import { APIPage } from "./openapi";

const mdxComponents = {
  ...defaultMdxComponents,
  APIPage,
};

/**
 * Catch-all `[...slug]` (not `[[...slug]]`) — bare `/documentation` falls
 * through to the `next.config.ts` redirect, keeping the "docs landing"
 * decision in one place instead of branching on `slug?.length === 0`.
 *
 * Explicit `Promise<{...}>` (not Next 16's `PageProps<>` global) so
 * `tsc --noEmit` runs in CI without first running `next typegen`.
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
