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
  "migrate-from-bitly": () => import("../../../content/docs/migrate-from-bitly.mdx"),
  abuse: () => import("../../../content/docs/abuse.mdx"),
  api: () => import("../../../content/docs/api/index.mdx"),
  "api/create-link": () => import("../../../content/docs/api/create-link.mdx"),
  "api/get-link": () => import("../../../content/docs/api/get-link.mdx"),
  "api/list-links": () => import("../../../content/docs/api/list-links.mdx"),
  "api/update-link": () => import("../../../content/docs/api/update-link.mdx"),
  "api/delete-link": () => import("../../../content/docs/api/delete-link.mdx"),
  "api/link-analytics": () => import("../../../content/docs/api/link-analytics.mdx"),
  "api/get-me": () => import("../../../content/docs/api/get-me.mdx"),
  "api/verify-click": () => import("../../../content/docs/api/verify-click.mdx"),
  "integrations/browser-extension": () =>
    import("../../../content/docs/integrations/browser-extension.mdx"),
  "integrations/raycast": () => import("../../../content/docs/integrations/raycast.mdx"),
  "integrations/n8n": () => import("../../../content/docs/integrations/n8n.mdx"),
  "self-hosting": () => import("../../../content/docs/self-hosting.mdx"),
} satisfies { [Slug in DocsSlug]: () => Promise<DocsModule> };
