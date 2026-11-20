import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { docsDirectory, docsFilePath, docsFrontmatterSchema, getDocsPageContent } from "./content";
import { DOCS_PAGES, docsHref } from "./navigation";
import { DOCS_PAGE_MODULES } from "./pages";
import { legacyDocsRedirectPath } from "./routing";

const apiDirectory = path.join(process.cwd(), "src/app/api/v1");

function listFiles(directory: string, match: (name: string) => boolean): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath, match);
    return match(entry.name) ? [fullPath] : [];
  });
}

/** "METHOD /api/v1/links/{alias}" for every handler exported by a v1 route file. */
function apiEndpoints(): string[] {
  return listFiles(apiDirectory, (name) => name === "route.ts").flatMap((file) => {
    const routePath = path
      .relative(path.join(process.cwd(), "src/app"), path.dirname(file))
      .split(path.sep)
      .map((segment) => segment.replace(/^\[(.+)\]$/, "{$1}"))
      .join("/");
    const source = fs.readFileSync(file, "utf8");
    const methods = [
      ...source.matchAll(/export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g),
    ].map((match) => match[1]);
    return methods.map((method) => `${method} /${routePath}`);
  });
}

function documentedEndpoints(): string[] {
  return DOCS_PAGES.flatMap((page) => {
    const { endpoint } = getDocsPageContent(page.slug).frontmatter;
    return endpoint ? [`${endpoint.method} ${endpoint.path}`] : [];
  });
}

describe("API reference", () => {
  test("documents every endpoint under src/app/api/v1", () => {
    const endpoints = apiEndpoints();
    expect(endpoints.length).toBeGreaterThan(0);
    const documented = new Set(documentedEndpoints());
    const undocumented = endpoints.filter((endpoint) => !documented.has(endpoint));
    expect(undocumented).toEqual([]);
  });

  test("documents only endpoints that exist", () => {
    const endpoints = new Set(apiEndpoints());
    const stale = documentedEndpoints().filter((endpoint) => !endpoints.has(endpoint));
    expect(stale).toEqual([]);
  });
});

describe("docs content", () => {
  test("every navigation page has an MDX file with valid frontmatter and a loader", () => {
    for (const page of DOCS_PAGES) {
      const source = fs.readFileSync(docsFilePath(page.slug), "utf8");
      expect(docsFrontmatterSchema.safeParse(matter(source).data).success).toBe(true);
      expect(DOCS_PAGE_MODULES[page.slug]).toBeFunction();
    }
  });

  test("every MDX file is in the navigation", () => {
    const files = listFiles(docsDirectory, (name) => name.endsWith(".mdx")).sort();
    const pages = DOCS_PAGES.map((page) => docsFilePath(page.slug)).sort();
    expect(files).toEqual(pages);
  });

  test("links between docs pages point at existing pages and headings", () => {
    const broken: string[] = [];
    for (const page of DOCS_PAGES) {
      const source = fs.readFileSync(docsFilePath(page.slug), "utf8");
      for (const [, target] of source.matchAll(/\]\((\/docs[^)\s]*)\)/g)) {
        const [pathname = "", hash] = target!.split("#");
        const linked = DOCS_PAGES.find((candidate) => docsHref(candidate.slug) === pathname);
        const ids = linked ? getDocsPageContent(linked.slug).headings.map((h) => h.id) : [];
        if (!linked || (hash && !ids.includes(hash))) broken.push(`${page.slug}: ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe("legacyDocsRedirectPath", () => {
  test("maps old docs.ishortn.ink pages to their replacements", () => {
    expect(legacyDocsRedirectPath("/api")).toBe("/docs/api");
    expect(legacyDocsRedirectPath("/api-reference/endpoint/create")).toBe("/docs/api/create-link");
    expect(legacyDocsRedirectPath("/api-reference/endpoint/patch/")).toBe("/docs/api/update-link");
  });

  test("sends anything else to the docs home", () => {
    expect(legacyDocsRedirectPath("/")).toBe("/docs");
    expect(legacyDocsRedirectPath("/introduction")).toBe("/docs");
  });
});
