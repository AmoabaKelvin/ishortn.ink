import { describe, expect, test } from "bun:test";

import { getCachedRedirectTarget } from "./short-link-request";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function visit(url: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  const host = new URL(url).host;
  return new Request(url, {
    method: init.method ?? "GET",
    headers: { host, "user-agent": BROWSER_UA, ...init.headers },
  });
}

describe("getCachedRedirectTarget", () => {
  test("a short link visit resolves to its domain and lowercased alias", () => {
    expect(getCachedRedirectTarget(visit("https://isht.app/Launch-Day"))).toEqual({
      domain: "isht.app",
      alias: "launch-day",
    });
    expect(getCachedRedirectTarget(visit("https://ishortn.ink/abc?utm_source=x"))).toEqual({
      domain: "ishortn.ink",
      alias: "abc",
    });
    expect(getCachedRedirectTarget(visit("https://go.example.com/promo"))).toEqual({
      domain: "go.example.com",
      alias: "promo",
    });
  });

  test("HEAD is answered like GET; other methods go to Next", () => {
    expect(
      getCachedRedirectTarget(visit("https://isht.app/abc", { method: "HEAD" })),
    ).not.toBeNull();
    expect(getCachedRedirectTarget(visit("https://isht.app/abc", { method: "POST" }))).toBeNull();
  });

  test("the page's domain rules apply: www stripped, forwarded host wins, previews use the default", () => {
    expect(getCachedRedirectTarget(visit("https://www.go.example.com/abc"))?.domain).toBe(
      "go.example.com",
    );
    expect(
      getCachedRedirectTarget(
        visit("https://isht.app/abc", { headers: { "x-forwarded-host": "go.example.com" } }),
      )?.domain,
    ).toBe("go.example.com");
    expect(getCachedRedirectTarget(visit("https://ishortn.preview.workers.dev/abc"))?.domain).toBe(
      "isht.app",
    );
  });

  test("percent-encoded aliases are decoded the way Next decodes route params", () => {
    expect(getCachedRedirectTarget(visit("https://isht.app/caf%C3%A9"))?.alias).toBe("café");
    expect(getCachedRedirectTarget(visit("https://isht.app/%E0%A4%A"))).toBeNull();
  });

  test("app routes, multi-segment paths and the root go to Next", () => {
    for (const path of ["/", "/dashboard", "/pricing", "/api", "/robots.txt", "/a/b", "/abc/"]) {
      expect(getCachedRedirectTarget(visit(`https://ishortn.ink${path}`))).toBeNull();
    }
    for (const path of [
      "/blocked/1",
      "/expired/1",
      "/scheduled/1",
      "/verify-password/1",
      "/cloaked/x",
      "/c/AbCdEfGhIjKl",
      "/c/AbCdEfGhIjKl/vcf",
    ]) {
      expect(getCachedRedirectTarget(visit(`https://isht.app${path}`))).toBeNull();
    }
  });

  test("paths middleware.ts handles before the page go to Next", () => {
    expect(getCachedRedirectTarget(visit("https://ishortn.ink/docs"))).toBeNull();
    expect(getCachedRedirectTarget(visit("https://docs.ishortn.ink/abc"))).toBeNull();
  });

  test("next.config.js redirect sources go to Next", async () => {
    const config = (await import("../../../next.config.js")).default;
    const redirects: { source: string }[] = await config.redirects();
    expect(redirects.length).toBeGreaterThan(0);
    for (const { source } of redirects) {
      expect(getCachedRedirectTarget(visit(`https://ishortn.ink${source}`))).toBeNull();
    }
  });

  test("app-host paths with their own next.config.js headers or middleware rewrite go to Next", async () => {
    const config = (await import("../../../next.config.js")).default;
    const rules: { source: string }[] = await config.headers();
    const sources = rules
      .map(({ source }) => source.replace(/\/:path\*$/, ""))
      .filter((source) => source !== "/(.*)" && source !== "");
    expect(sources.length).toBeGreaterThan(0);
    for (const source of [...sources, "/mcp"]) {
      expect(getCachedRedirectTarget(visit(`https://ishortn.ink${source}`))).toBeNull();
    }
  });

  test("previews, crawlers, .png and RSC requests go to Next", () => {
    expect(getCachedRedirectTarget(visit("https://isht.app/abc!"))).toBeNull();
    expect(getCachedRedirectTarget(visit("https://isht.app/abc.PNG"))).toBeNull();
    expect(
      getCachedRedirectTarget(
        visit("https://isht.app/abc", { headers: { "user-agent": "WhatsApp/2.23.20.0" } }),
      ),
    ).toBeNull();
    expect(
      getCachedRedirectTarget(visit("https://isht.app/abc", { headers: { rsc: "1" } })),
    ).toBeNull();
    expect(getCachedRedirectTarget(visit("https://isht.app/abc?_rsc=x1"))).toBeNull();
    expect(getCachedRedirectTarget(visit("https://isht.app/abc?__clerk_handshake=x"))).toBeNull();
  });
});
