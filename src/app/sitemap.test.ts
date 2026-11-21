import { describe, expect, it } from "bun:test";

import { getChangelogEntries } from "@/lib/changelog";
import { competitors } from "@/lib/seo/competitors";

// test/setup.ts sets NEXT_PUBLIC_APP_URL before env.mjs loads.
import sitemap from "./sitemap";

describe("sitemap", () => {
  // Each call renders every blog post through remark (~4s under a full parallel run), so two calls
  // exceed bun's 5s default.
  it("returns the same lastModified values on every call", async () => {
    const first = await sitemap();
    await Bun.sleep(5);
    const second = await sitemap();
    expect(second).toEqual(first);
  }, 30_000);

  it("lists the compare hub and dates each compare page by its prices check", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://ishortn.ink/compare");

    for (const competitor of Object.values(competitors)) {
      const entry = entries.find((e) => e.url === `https://ishortn.ink/compare/${competitor.slug}`);
      expect(entry?.lastModified).toBe(competitor.pricesCheckedOn);
    }
  });

  it("lists the UTM builder", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain("https://ishortn.ink/utm-builder");
  });

  it("dates the changelog by its newest entry", async () => {
    const [entries, changelog] = await Promise.all([sitemap(), getChangelogEntries()]);
    const entry = entries.find((e) => e.url === "https://ishortn.ink/changelog");
    const newest = changelog[0]?.date.slice(0, 10);
    expect(newest).toBeDefined();
    expect(entry?.lastModified).toBe(newest);
  });
});
