import "server-only";

import type { DocsSlug } from "./navigation";
import type { MDXContent } from "mdx/types";

type DocsModule = { default: MDXContent };

// Static imports per page so the bundler compiles each MDX file at build time.
export const DOCS_PAGE_MODULES = {
  "": () => import("../../../content/docs/index.mdx"),
  plans: () => import("../../../content/docs/plans.mdx"),
  "short-links": () => import("../../../content/docs/short-links.mdx"),
  "platform-domains": () => import("../../../content/docs/platform-domains.mdx"),
  "custom-domains": () => import("../../../content/docs/custom-domains.mdx"),
  "qr-codes": () => import("../../../content/docs/qr-codes.mdx"),
  "bio-pages": () => import("../../../content/docs/bio-pages.mdx"),
  analytics: () => import("../../../content/docs/analytics.mdx"),
  teams: () => import("../../../content/docs/teams.mdx"),
  "bulk-import": () => import("../../../content/docs/bulk-import.mdx"),
  abuse: () => import("../../../content/docs/abuse.mdx"),
  api: () => import("../../../content/docs/api/index.mdx"),
  "api/create-link": () => import("../../../content/docs/api/create-link.mdx"),
  "api/get-link": () => import("../../../content/docs/api/get-link.mdx"),
  "api/update-link": () => import("../../../content/docs/api/update-link.mdx"),
  "api/link-analytics": () => import("../../../content/docs/api/link-analytics.mdx"),
  "api/verify-click": () => import("../../../content/docs/api/verify-click.mdx"),
} satisfies { [Slug in DocsSlug]: () => Promise<DocsModule> };
