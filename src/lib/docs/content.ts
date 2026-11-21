import "server-only";

import fs from "fs";
import path from "path";

import matter from "gray-matter";
import { z } from "zod";

import { DOCS_PAGES, docsHref } from "./navigation";
import { buildSearchRecords, extractHeadings } from "./utils";

import type { DocsSearchRecord } from "./utils";

export const docsDirectory = path.join(process.cwd(), "content/docs");

export const docsFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  // API reference pages name the route they document; docs.test.ts checks
  // every route under src/app/api/v1 is covered.
  endpoint: z
    .object({
      method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]),
      path: z.string(),
    })
    .optional(),
});

export type DocsFrontmatter = z.infer<typeof docsFrontmatterSchema>;

export function docsFilePath(slug: string): string {
  const isIndex = slug === "" || slug === "api";
  return path.join(docsDirectory, isIndex ? `${slug}/index.mdx` : `${slug}.mdx`);
}

function readDocsFile(slug: string) {
  const { data, content } = matter(fs.readFileSync(docsFilePath(slug), "utf8"));
  return { frontmatter: docsFrontmatterSchema.parse(data), body: content };
}

export function getDocsPageContent(slug: string) {
  const { frontmatter, body } = readDocsFile(slug);
  return { frontmatter, headings: extractHeadings(body) };
}

export function getDocsSearchIndex(): DocsSearchRecord[] {
  return DOCS_PAGES.flatMap((page) => {
    const { frontmatter, body } = readDocsFile(page.slug);
    return buildSearchRecords(
      {
        href: docsHref(page.slug),
        title: frontmatter.title,
        section: page.section,
        description: frontmatter.description,
      },
      body,
    );
  });
}
