import { describe, expect, it } from "bun:test";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";

import { homeGuideSlugs } from "@/lib/copy/landing-page";

import { Footer } from "./footer";
import { FreeTools, Guides } from "./resources";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReactNode } from "react";

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
const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>{node}</AppRouterContext.Provider>,
  );

// Anchors only: sprite icons are <use href="/site-icons.svg#…">.
const hrefs = (html: string) =>
  [...html.matchAll(/<a\s[^>]*?href="([^"]+)"/g)].map((match) => match[1]);

// how-to-track-qr-code-scans is dated 2026-11-20; the other curated posts are older.
const guidesOn = (now: string) => hrefs(render(<Guides now={new Date(now)} />));

describe("homepage resources", () => {
  it("links the three free tools", () => {
    expect(hrefs(render(<FreeTools />))).toEqual([
      "/qr-code-generator",
      "/utm-builder",
      "/whatsapp-link-generator",
    ]);
  });

  it("links every curated guide once it is live, in order, plus the blog index", () => {
    expect(guidesOn("2026-11-20T00:00:00Z")).toEqual([
      "/blog",
      ...homeGuideSlugs.map((slug) => `/blog/${slug}`),
    ]);
  });

  it("leaves out a curated guide scheduled after today", () => {
    const links = guidesOn("2026-11-19T23:59:59Z");
    expect(links).not.toContain("/blog/how-to-track-qr-code-scans");
    expect(links).toHaveLength(homeGuideSlugs.length);
  });

  it("uses the post title as the anchor text", () => {
    const html = render(<Guides now={new Date("2026-11-20T00:00:00Z")} />);
    expect(html).toContain("What Is a URL Shortener and How Does It Work?");
  });
});

describe("footer", () => {
  it("links the Portuguese WhatsApp generator with its language", () => {
    const html = render(<Footer />);
    const anchor = html.match(/<a [^>]*href="\/gerador-de-link-whatsapp"[^>]*>/)?.[0];
    expect(anchor).toContain('hrefLang="pt-BR"');
    expect(anchor).toContain('lang="pt-BR"');
  });
});
