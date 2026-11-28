import { beforeAll, describe, expect, it } from "bun:test";

import { resolveSitemap } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";

import { getChangelogEntries } from "@/lib/changelog";
import { competitors } from "@/lib/seo/competitors";
import { solutionList } from "@/lib/seo/solutions";

// test/setup.ts sets NEXT_PUBLIC_APP_URL before env.mjs loads.
import sitemap from "./sitemap";

describe("sitemap", () => {
  // Each call renders every blog post through remark (~4s under a full parallel run, more on a busy
  // host), so the read-only tests share one result instead of rendering per test.
  let shared: ReturnType<typeof sitemap> | undefined;
  const entries = () => (shared ??= sitemap());
  beforeAll(async () => {
    await entries();
  }, 30_000);

  it("returns the same lastModified values on every call", async () => {
    const first = await sitemap();
    await Bun.sleep(5);
    const second = await sitemap();
    expect(second).toEqual(first);
  }, 30_000);

  it("lists the compare hub and dates each compare page by its prices check", async () => {
    const list = await entries();
    const urls = list.map((entry) => entry.url);
    expect(urls).toContain("https://ishortn.ink/compare");

    for (const competitor of Object.values(competitors)) {
      const entry = list.find((e) => e.url === `https://ishortn.ink/compare/${competitor.slug}`);
      expect(entry?.lastModified).toBe(competitor.pricesCheckedOn);
    }
  });

  it("lists the UTM builder", async () => {
    const urls = (await entries()).map((entry) => entry.url);
    expect(urls).toContain("https://ishortn.ink/utm-builder");
    expect(urls).toContain("https://ishortn.ink/url-expander");
  });

  it("lists the open-source URL shortener page", async () => {
    const urls = (await entries()).map((entry) => entry.url);
    expect(urls).toContain("https://ishortn.ink/open-source-url-shortener");
  });

  it("lists the AIRO customer story", async () => {
    const entry = (await entries()).find((e) => e.url === "https://ishortn.ink/customers/airo");
    expect(entry?.lastModified).toBe("2026-11-27");
  });

  it("lists the Chrome extension page", async () => {
    const urls = (await entries()).map((entry) => entry.url);
    expect(urls).toContain("https://ishortn.ink/extension");
  });

  it("lists the WhatsApp link generator in English and Portuguese, each with both alternates", async () => {
    const list = await entries();
    const languages = {
      en: "https://ishortn.ink/whatsapp-link-generator",
      "pt-BR": "https://ishortn.ink/gerador-de-link-whatsapp",
    };
    for (const url of Object.values(languages)) {
      const entry = list.find((e) => e.url === url);
      expect(entry?.alternates?.languages).toEqual(languages);
    }

    // What Next.js serves as /sitemap.xml.
    const xml = resolveSitemap(list);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    for (const [language, href] of Object.entries(languages)) {
      expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="${language}" href="${href}" />`);
    }
  });

  it("lists the solutions hub and dates each solution page by its last copy update", async () => {
    const list = await entries();
    expect(list.map((entry) => entry.url)).toContain("https://ishortn.ink/solutions");

    for (const solution of solutionList) {
      const entry = list.find((e) => e.url === `https://ishortn.ink/solutions/${solution.slug}`);
      expect(entry?.lastModified).toBe(solution.updatedOn);
    }
  });

  it("dates the changelog by its newest entry", async () => {
    const [list, changelog] = await Promise.all([entries(), getChangelogEntries()]);
    const entry = list.find((e) => e.url === "https://ishortn.ink/changelog");
    const newest = changelog[0]?.date.slice(0, 10);
    expect(newest).toBeDefined();
    expect(entry?.lastModified).toBe(newest);
  });
});
