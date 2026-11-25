import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PLATFORM_DOMAIN,
  PLATFORM_DOMAINS,
  extractPlatformSubdomain,
  isAppHost,
  isPlatformDomain,
} from "./domains";

describe("platform domains", () => {
  test("isht.app is the default for new links and the older domains stay valid", () => {
    expect(PLATFORM_DOMAINS).toEqual(["isht.app", "isht.ink", "ishortn.ink"]);
    expect(DEFAULT_PLATFORM_DOMAIN).toBe("isht.app");
    for (const domain of PLATFORM_DOMAINS) expect(isPlatformDomain(domain)).toBe(true);
    expect(isPlatformDomain("go.customer.com")).toBe(false);
    expect(isPlatformDomain("acme.isht.app")).toBe(false);
  });
});

describe("extractPlatformSubdomain", () => {
  test("reads team subdomains on every platform domain", () => {
    expect(extractPlatformSubdomain("acme.isht.app")).toBe("acme");
    expect(extractPlatformSubdomain("Acme.ISHT.app.")).toBe("acme");
    expect(extractPlatformSubdomain("acme.isht.ink")).toBe("acme");
    expect(extractPlatformSubdomain("ACME.ishortn.ink.")).toBe("acme");
  });

  test("ignores bare platform hosts and deeper or foreign hosts", () => {
    for (const host of [
      "isht.app",
      "isht.ink",
      "ishortn.ink",
      "a.b.isht.ink",
      "a.b.isht.app",
      "acme.example.com",
    ]) {
      expect(extractPlatformSubdomain(host)).toBeNull();
    }
  });
});

describe("isAppHost", () => {
  test("accepts the app domain, local dev and previews", () => {
    for (const host of [
      "ishortn.ink",
      "ISHORTN.INK",
      "ishortn.ink.",
      "localhost:3000",
      "app.acme.workers.dev",
    ]) {
      expect(isAppHost(host)).toBe(true);
    }
  });

  test("rejects short-link, team and custom domains", () => {
    for (const host of [
      "isht.app",
      "isht.ink",
      "www.ishortn.ink",
      "acme.ishortn.ink",
      "go.customer.com",
      "ishortn.ink.evil.com",
    ]) {
      expect(isAppHost(host)).toBe(false);
    }
  });
});
