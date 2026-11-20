import { describe, expect, it } from "bun:test";

import { competitors } from "@/lib/seo/competitors";

// absoluteUrl reads NEXT_PUBLIC_APP_URL through env.mjs at import time, so set it before loading.
process.env.NEXT_PUBLIC_APP_URL ??= "https://ishortn.ink";
const { default: sitemap } = await import("./sitemap");

describe("sitemap", () => {
  it("returns the same lastModified values on every call", async () => {
    const first = await sitemap();
    await Bun.sleep(5);
    const second = await sitemap();
    expect(second).toEqual(first);
  });

  it("lists the compare hub and dates each compare page by its prices check", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://ishortn.ink/compare");

    for (const competitor of Object.values(competitors)) {
      const entry = entries.find((e) => e.url === `https://ishortn.ink/compare/${competitor.slug}`);
      expect(entry?.lastModified).toBe(competitor.pricesCheckedOn);
    }
  });
});
