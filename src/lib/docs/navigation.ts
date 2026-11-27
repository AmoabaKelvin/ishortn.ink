// Docs sidebar, prev/next order and sitemap all come from this list. Each slug
// maps to content/docs/<slug>.mdx ("" is content/docs/index.mdx, "api" is
// content/docs/api/index.mdx); src/lib/docs/pages.ts loads the compiled MDX.
export const DOCS_SECTIONS = [
  {
    title: "Get started",
    pages: [
      { slug: "", title: "Getting started" },
      { slug: "plans", title: "Plans and limits" },
    ],
  },
  {
    title: "Guides",
    pages: [
      { slug: "short-links", title: "Short links" },
      { slug: "platform-domains", title: "Platform domains" },
      { slug: "custom-domains", title: "Custom domains" },
      { slug: "qr-codes", title: "QR codes" },
      { slug: "bio-pages", title: "Link-in-bio pages" },
      { slug: "analytics", title: "Analytics" },
      { slug: "teams", title: "Teams and workspaces" },
      { slug: "bulk-import", title: "CSV bulk import" },
      { slug: "migrate-from-bitly", title: "Move from Bitly" },
      { slug: "abuse", title: "Abuse and acceptable use" },
    ],
  },
  {
    title: "API reference",
    pages: [
      { slug: "api", title: "Overview" },
      { slug: "api/create-link", title: "Create a link" },
      { slug: "api/get-link", title: "Get a link" },
      { slug: "api/list-links", title: "List links" },
      { slug: "api/update-link", title: "Update a link" },
      { slug: "api/delete-link", title: "Delete a link" },
      { slug: "api/link-analytics", title: "Link analytics" },
      { slug: "api/get-me", title: "Get your account" },
      { slug: "api/verify-click", title: "Verify a click" },
    ],
  },
  {
    title: "Integrations",
    pages: [
      { slug: "integrations/browser-extension", title: "Browser extension" },
      { slug: "integrations/raycast", title: "Raycast" },
      { slug: "integrations/n8n", title: "n8n" },
      { slug: "integrations/mcp", title: "MCP server" },
    ],
  },
  {
    title: "Self-hosting",
    pages: [{ slug: "self-hosting", title: "Self-hosting iShortn" }],
  },
] as const;

export type DocsSection = (typeof DOCS_SECTIONS)[number];
export type DocsNavPage = DocsSection["pages"][number];
export type DocsSlug = DocsNavPage["slug"];

export const DOCS_PAGES: readonly (DocsNavPage & { section: string })[] = DOCS_SECTIONS.flatMap(
  (section) => section.pages.map((page) => ({ ...page, section: section.title })),
);

export const DOCS_BASE_PATH = "/docs";

export function docsHref(slug: string): string {
  return slug ? `${DOCS_BASE_PATH}/${slug}` : DOCS_BASE_PATH;
}

export function findDocsPage(slug: string) {
  return DOCS_PAGES.find((page) => page.slug === slug);
}

export function getDocsNeighbours(slug: string) {
  const index = DOCS_PAGES.findIndex((page) => page.slug === slug);
  if (index === -1) return { previous: undefined, next: undefined };
  return { previous: DOCS_PAGES[index - 1], next: DOCS_PAGES[index + 1] };
}
