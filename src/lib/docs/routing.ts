// Edge-safe: imported by src/middleware.ts, so no Node or db imports here.

// The docs pages are built under this internal path. The middleware rewrites
// /docs/* to it only on the app host, so /docs on every short-link domain
// (isht.app, custom domains, ...) still resolves the "docs" short link.
export const DOCS_INTERNAL_PATH = "/docs-site";

export function isDocsPath(pathname: string): boolean {
  return pathname === "/docs" || pathname.startsWith("/docs/");
}

export function toInternalDocsPath(pathname: string): string {
  return `${DOCS_INTERNAL_PATH}${pathname.slice("/docs".length)}`;
}

// Pages of the retired external docs site (docs.ishortn.ink), mapped to their
// replacements so old links and bookmarks keep working.
const LEGACY_DOCS_PATHS = new Map([
  ["/api", "/docs/api"],
  ["/api-reference", "/docs/api"],
  ["/api-reference/introduction", "/docs/api"],
  ["/api-reference/endpoint/create", "/docs/api/create-link"],
  ["/api-reference/endpoint/get", "/docs/api/get-link"],
  ["/api-reference/endpoint/patch", "/docs/api/update-link"],
  ["/api-reference/endpoint/analytics", "/docs/api/link-analytics"],
]);

export function legacyDocsRedirectPath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "").toLowerCase();
  return LEGACY_DOCS_PATHS.get(normalized) ?? "/docs";
}
