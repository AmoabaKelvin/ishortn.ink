import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getDocsPageContent } from "@/lib/docs/content";
import { DOCS_PAGES, docsHref, findDocsPage, getDocsNeighbours } from "@/lib/docs/navigation";
import { DOCS_PAGE_MODULES } from "@/lib/docs/pages";

import { DocsToc } from "../_components/docs-toc";

import type { Metadata } from "next";

type DocsPageProps = { params: Promise<{ slug?: string[] }> };

// Every page is prerendered; unknown paths 404 without touching the filesystem.
export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS_PAGES.map((page) => ({ slug: page.slug ? page.slug.split("/") : [] }));
}

async function resolvePage(params: DocsPageProps["params"]) {
  const { slug = [] } = await params;
  const page = findDocsPage(slug.join("/"));
  if (!page) notFound();
  return page;
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const page = await resolvePage(params);
  const { frontmatter } = getDocsPageContent(page.slug);
  const url = `https://ishortn.ink${docsHref(page.slug)}`;
  const title = page.slug === "" ? "Documentation" : `${frontmatter.title} · Docs`;

  return {
    title,
    description: frontmatter.description,
    alternates: { canonical: url },
    openGraph: { title, description: frontmatter.description, url, type: "article" },
    twitter: { card: "summary_large_image", title, description: frontmatter.description },
  };
}

const METHOD_LABEL_CLASS =
  "rounded-md bg-neutral-900 px-1.5 py-0.5 font-mono text-sm font-semibold text-white dark:bg-white dark:text-neutral-900";

export default async function DocsPage({ params }: DocsPageProps) {
  const page = await resolvePage(params);
  const { frontmatter, headings } = getDocsPageContent(page.slug);
  const { default: Content } = await DOCS_PAGE_MODULES[page.slug]();
  const { previous, next } = getDocsNeighbours(page.slug);

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-x-12">
      <main id="docs-content" className="min-w-0 py-10 sm:py-12">
        <article className="mx-auto max-w-[72ch] xl:mx-0">
          <header>
            <p className="text-base font-medium text-neutral-500 sm:text-sm dark:text-neutral-400">
              {page.section}
            </p>
            <h1 className="mt-2 text-pretty font-title text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
              {frontmatter.title}
            </h1>
            <p className="mt-3 max-w-[60ch] text-pretty text-lg text-neutral-600 dark:text-neutral-400">
              {frontmatter.description}
            </p>
            {frontmatter.endpoint ? (
              <p className="mt-5 flex min-w-0 items-center gap-2 rounded-xl bg-neutral-950/[0.04] p-2 pr-3 dark:bg-white/[0.06]">
                <span className={METHOD_LABEL_CLASS}>{frontmatter.endpoint.method}</span>
                <code className="min-w-0 break-all font-mono text-sm text-neutral-900 dark:text-white">
                  https://ishortn.ink{frontmatter.endpoint.path}
                </code>
              </p>
            ) : null}
          </header>

          <div className="docs-prose mt-10">
            <Content />
          </div>

          <nav
            aria-label="Previous and next page"
            className="mt-16 grid gap-4 border-t border-neutral-950/[0.07] pt-8 sm:grid-cols-2 dark:border-white/10"
          >
            {previous ? (
              <Link
                href={docsHref(previous.slug)}
                className="flex flex-col rounded-2xl p-4 ring-1 ring-neutral-950/[0.07] hover:bg-neutral-50 dark:ring-white/10 dark:hover:bg-white/5"
              >
                <span className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                  <IconChevronLeft aria-hidden="true" className="size-4 shrink-0" />
                  Previous
                </span>
                <span className="mt-1 font-medium text-neutral-900 dark:text-white">
                  {previous.title}
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <Link
                href={docsHref(next.slug)}
                className="flex flex-col items-end rounded-2xl p-4 text-right ring-1 ring-neutral-950/[0.07] hover:bg-neutral-50 dark:ring-white/10 dark:hover:bg-white/5"
              >
                <span className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Next
                  <IconChevronRight aria-hidden="true" className="size-4 shrink-0" />
                </span>
                <span className="mt-1 font-medium text-neutral-900 dark:text-white">
                  {next.title}
                </span>
              </Link>
            ) : null}
          </nav>

          <p className="mt-10 text-base text-neutral-500 sm:text-sm dark:text-neutral-400">
            Something missing or unclear? Email{" "}
            <a
              href="mailto:support@ishortn.ink"
              className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900 dark:text-white dark:decoration-neutral-600 dark:hover:decoration-white"
            >
              support@ishortn.ink
            </a>
            .
          </p>
        </article>
      </main>

      <aside className="sticky top-16 hidden max-h-[calc(100dvh-4rem)] overflow-y-auto py-12 xl:block">
        <DocsToc headings={headings} />
      </aside>
    </div>
  );
}
