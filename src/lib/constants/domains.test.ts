import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PLATFORM_DOMAIN,
  PLATFORM_DOMAINS,
  extractPlatformSubdomain,
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
  test("reads team subdomains on isht.ink and ishortn.ink", () => {
    expect(extractPlatformSubdomain("acme.isht.ink")).toBe("acme");
    expect(extractPlatformSubdomain("ACME.ishortn.ink.")).toBe("acme");
  });

  test("never treats an isht.app host as a team subdomain", () => {
    expect(extractPlatformSubdomain("acme.isht.app")).toBeNull();
  });

  test("ignores bare platform hosts and deeper or foreign hosts", () => {
    for (const host of [
      "isht.app",
      "isht.ink",
      "ishortn.ink",
      "a.b.isht.ink",
      "acme.example.com",
    ]) {
      expect(extractPlatformSubdomain(host)).toBeNull();
    }
  });
});
