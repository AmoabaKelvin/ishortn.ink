import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { APP_TOP_LEVEL_SEGMENTS, getMarketingRedirectUrl, isShortLinkPath } from "./indexing";

describe("getMarketingRedirectUrl", () => {
  test("moves marketing routes on other platform hosts to the bare app domain", () => {
    expect(getMarketingRedirectUrl("www.ishortn.ink", "/pricing", "")).toBe(
      "https://ishortn.ink/pricing",
    );
    expect(getMarketingRedirectUrl("isht.app", "/", "")).toBe("https://ishortn.ink/");
    expect(getMarketingRedirectUrl("status.ishortn.ink", "/blog", "")).toBe(
      "https://ishortn.ink/blog",
    );
    expect(getMarketingRedirectUrl("isht.ink", "/blog/some-post", "?ref=x")).toBe(
      "https://ishortn.ink/blog/some-post?ref=x",
    );
    expect(getMarketingRedirectUrl("ISHT.INK:443", "/compare/bitly", "")).toBe(
      "https://ishortn.ink/compare/bitly",
    );
    expect(getMarketingRedirectUrl("acme.ishortn.ink", "/sitemap.xml", "")).toBe(
      "https://ishortn.ink/sitemap.xml",
    );
    expect(getMarketingRedirectUrl("www.ishortn.ink", "/llms.txt", "")).toBe(
      "https://ishortn.ink/llms.txt",
    );
    expect(getMarketingRedirectUrl("isht.app", "/llms.txt", "")).toBe(
      "https://ishortn.ink/llms.txt",
    );
  });

  test("leaves the app domain, short links, app routes and other hosts alone", () => {
    expect(getMarketingRedirectUrl("ishortn.ink", "/pricing", "")).toBeNull();
    expect(getMarketingRedirectUrl("ishortn.ink", "/llms.txt", "")).toBeNull();
    expect(getMarketingRedirectUrl("isht.ink", "/abc123", "")).toBeNull();
    expect(getMarketingRedirectUrl("www.ishortn.ink", "/abc123", "")).toBeNull();
    expect(getMarketingRedirectUrl("isht.app", "/blogpost", "")).toBeNull();
    expect(getMarketingRedirectUrl("isht.app", "/p/my-bio", "")).toBeNull();
    expect(getMarketingRedirectUrl("acme.isht.app", "/", "")).toBeNull();
    expect(getMarketingRedirectUrl("go.customer.com", "/", "")).toBeNull();
    expect(getMarketingRedirectUrl("localhost:3000", "/pricing", "")).toBeNull();
    expect(getMarketingRedirectUrl("ishortn.workers.dev", "/", "")).toBeNull();
  });
});

describe("isShortLinkPath", () => {
  test("matches short-link aliases and link interstitials", () => {
    expect(isShortLinkPath("/abc123")).toBe(true);
    expect(isShortLinkPath("/abc123!")).toBe(true);
    expect(isShortLinkPath("/blocked/42")).toBe(true);
    expect(isShortLinkPath("/expired/42")).toBe(true);
    expect(isShortLinkPath("/scheduled/42")).toBe(true);
    expect(isShortLinkPath("/verify-password/42")).toBe(true);
    expect(isShortLinkPath("/verified-redirect/abc")).toBe(true);
    expect(isShortLinkPath("/cloaked/https%3A%2F%2Fexample.com")).toBe(true);
  });

  test("leaves app and marketing routes indexable", () => {
    for (const path of ["/", "/pricing", "/blog", "/blog/post", "/dashboard", "/p/bio"]) {
      expect(isShortLinkPath(path)).toBe(false);
    }
    expect(isShortLinkPath("/robots.txt")).toBe(false);
    expect(isShortLinkPath("/sitemap.xml")).toBe(false);
    expect(isShortLinkPath("/llms.txt")).toBe(false);
  });

  test("never treats the social image folder as a short link", () => {
    expect(isShortLinkPath("/social")).toBe(false);
    expect(isShortLinkPath("/social/ishortn-mark.png")).toBe(false);
  });

  test("knows every top-level route under src/app", () => {
    const appDir = join(import.meta.dir, "../../app");
    const interstitials = [
      "blocked",
      "expired",
      "scheduled",
      "verify-password",
      "verified-redirect",
      "cloaked",
    ];
    const segments: string[] = [];
    const collect = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
        if (entry.name.startsWith("(")) collect(join(dir, entry.name));
        else if (!entry.name.startsWith("[")) segments.push(entry.name);
      }
    };
    collect(appDir);

    for (const segment of segments) {
      if (interstitials.includes(segment)) continue;
      expect({ segment, known: APP_TOP_LEVEL_SEGMENTS.has(segment) }).toEqual({
        segment,
        known: true,
      });
    }
  });
});
