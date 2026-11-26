import { describe, expect, it } from "bun:test";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";

import { getLivePosts } from "@/lib/blog";
import { homeGuideSlugs } from "@/lib/copy/landing-page";

import FeaturesPage, { metadata } from "./page";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// next-view-transitions' Link reads the app router; static rendering never navigates.
const noop = () => {};
const router: AppRouterInstance = {
  back: noop,
  forward: noop,
  refresh: noop,
  push: noop,
  replace: noop,
  prefetch: noop,
};

const html = renderToStaticMarkup(
  <AppRouterContext.Provider value={router}>
    <FeaturesPage />
  </AppRouterContext.Provider>,
);
const main = html.slice(html.indexOf("<main"), html.indexOf("<footer"));
const hrefs = [...main.matchAll(/<a\s[^>]*?href="([^"]+)"/g)].map((match) => match[1]);

describe("features page", () => {
  it("has a descriptive title and description", () => {
    expect(metadata.title).toBe("URL Shortener Features: Analytics, QR Codes, Domains");
    expect(metadata.description).toBe(
      "Click analytics by country, device and referrer, dynamic QR codes that never expire, custom domains, bio pages, bulk import, team workspaces and a REST API.",
    );
    expect(metadata.openGraph?.title).toBe("URL Shortener Features | iShortn");
    expect(metadata.openGraph?.description).toBe(metadata.description);
  });

  it("links the free tools, guides and comparisons from the main content", () => {
    for (const href of [
      "/qr-code-generator",
      "/utm-builder",
      "/whatsapp-link-generator",
      "/blog/bitly-alternatives",
      "/blog/best-free-url-shorteners",
      "/blog/url-shortener-vs-link-management-platform",
      "/compare",
      "/compare/bitly",
      "/compare/short-io",
      "/compare/dub",
      "/compare/rebrandly",
      "/compare/tinyurl",
      "/compare/linktree",
    ]) {
      expect(hrefs).toContain(href);
    }
  });

  it("links only curated guides that are live", () => {
    const live = new Set(getLivePosts(homeGuideSlugs).map((post) => post.slug));
    for (const slug of homeGuideSlugs) {
      expect(hrefs.includes(`/blog/${slug}`)).toBe(live.has(slug));
    }
  });
});
