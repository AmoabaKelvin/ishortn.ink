import { describe, expect, it } from "bun:test";

import { getWwwRedirectUrl } from "./www-redirect";

describe("getWwwRedirectUrl", () => {
  it("redirects www.ishortn.ink to the apex, keeping path and query", () => {
    expect(getWwwRedirectUrl("https://www.ishortn.ink/pricing?x=1")).toBe(
      "https://ishortn.ink/pricing?x=1",
    );
    expect(getWwwRedirectUrl("https://www.ishortn.ink/")).toBe("https://ishortn.ink/");
    expect(getWwwRedirectUrl("https://www.ishortn.ink")).toBe("https://ishortn.ink/");
  });

  it("upgrades http and drops a port or trailing dot", () => {
    expect(getWwwRedirectUrl("http://www.ishortn.ink/dashboard")).toBe(
      "https://ishortn.ink/dashboard",
    );
    expect(getWwwRedirectUrl("https://WWW.ishortn.ink./a?b=c&d")).toBe(
      "https://ishortn.ink/a?b=c&d",
    );
  });

  it("serves www API and webhook routes without redirecting", () => {
    for (const url of [
      "https://www.ishortn.ink/api",
      "https://www.ishortn.ink/api/webhooks/clerk",
      "https://www.ishortn.ink/api/webhooks/lemonsqueezy?x=1",
      "https://www.ishortn.ink/api/v1/links",
      "http://WWW.ishortn.ink./api/v1/links?page=2",
    ]) {
      expect(getWwwRedirectUrl(url)).toBeNull();
    }
  });

  it("still redirects www paths that only start with the letters api", () => {
    expect(getWwwRedirectUrl("https://www.ishortn.ink/apiary")).toBe("https://ishortn.ink/apiary");
    expect(getWwwRedirectUrl("https://www.ishortn.ink/docs/api")).toBe(
      "https://ishortn.ink/docs/api",
    );
  });

  it("leaves the apex, short-link, team and custom domains alone", () => {
    for (const url of [
      "https://ishortn.ink/",
      "https://ishortn.ink/abc123",
      "https://ishortn.ink/api/webhooks/clerk",
      "https://isht.ink/abc123",
      "https://www.isht.ink/abc123",
      "https://isht.app/abc123",
      "https://www.isht.app/abc123",
      "https://acme.ishortn.ink/abc123",
      "https://www.example.com/",
      "https://go.example.com/abc123",
      "http://localhost:3000/",
      "https://ishortn.workers.dev/",
    ]) {
      expect(getWwwRedirectUrl(url)).toBeNull();
    }
  });
});
