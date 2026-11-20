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

  it("leaves the apex, short-link, team and custom domains alone", () => {
    for (const url of [
      "https://ishortn.ink/",
      "https://ishortn.ink/abc123",
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
