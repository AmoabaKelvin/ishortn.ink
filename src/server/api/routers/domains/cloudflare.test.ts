import { describe, expect, it } from "bun:test";

import { env } from "@/env.mjs";

import { buildVerificationChallenges, isApexHostname, isRetiredCustomHostname } from "./cloudflare";

import type { CloudflareCustomHostname } from "./cloudflare";

function hostname(status: string, sslStatus?: string): CloudflareCustomHostname {
  return {
    id: "id",
    hostname: "example.com",
    status,
    ssl: sslStatus ? { status: sslStatus } : null,
  };
}

describe("isRetiredCustomHostname", () => {
  it("retires a hostname Cloudflare gave up validating", () => {
    expect(isRetiredCustomHostname(hostname("deleted", "validation_timed_out"))).toBe(true);
    expect(isRetiredCustomHostname(hostname("pending", "validation_timed_out"))).toBe(true);
    expect(isRetiredCustomHostname(hostname("deleted", "pending_validation"))).toBe(true);
  });

  it("leaves live hostnames alone", () => {
    expect(isRetiredCustomHostname(hostname("active", "active"))).toBe(false);
    expect(isRetiredCustomHostname(hostname("pending", "pending_validation"))).toBe(false);
    expect(isRetiredCustomHostname(hostname("pending", "initializing"))).toBe(false);
    expect(isRetiredCustomHostname(hostname("pending"))).toBe(false);
  });
});

describe("buildVerificationChallenges", () => {
  function txtHostname(name: string): CloudflareCustomHostname {
    return {
      id: "id",
      hostname: "unused",
      status: "pending",
      ssl: { status: "pending_validation" },
      ownership_verification: { type: "txt", name, value: "token" },
    };
  }

  function recordNames(domain: string) {
    const [cname, txt] = buildVerificationChallenges(
      domain,
      txtHostname(`_cf-custom-hostname.${domain}`),
    );
    return { cname: [cname?.domain, cname?.fqdn], txt: [txt?.domain, txt?.fqdn] };
  }

  it("names records relative to a multi-part public suffix", () => {
    expect(recordNames("links.acme.co.uk")).toEqual({
      cname: ["links", "links.acme.co.uk"],
      txt: ["_cf-custom-hostname.links", "_cf-custom-hostname.links.acme.co.uk"],
    });
  });

  it("treats a registrable domain under a multi-part suffix as the apex", () => {
    expect(recordNames("acme.co.uk")).toEqual({
      cname: ["@", "acme.co.uk"],
      txt: ["_cf-custom-hostname", "_cf-custom-hostname.acme.co.uk"],
    });
    expect(isApexHostname("acme.co.uk")).toBe(true);
  });

  it("handles single-label suffixes", () => {
    expect(recordNames("links.example.com")).toEqual({
      cname: ["links", "links.example.com"],
      txt: ["_cf-custom-hostname.links", "_cf-custom-hostname.links.example.com"],
    });
    expect(recordNames("example.com")).toEqual({
      cname: ["@", "example.com"],
      txt: ["_cf-custom-hostname", "_cf-custom-hostname.example.com"],
    });
    expect(isApexHostname("links.example.com")).toBe(false);
  });

  it("points the CNAME at the configured target and skips TXT without a challenge", () => {
    const challenges = buildVerificationChallenges("go.shop.com.br");
    expect(challenges).toEqual([
      {
        type: "CNAME",
        domain: "go",
        fqdn: "go.shop.com.br",
        value: env.CUSTOM_DOMAIN_CNAME_TARGET,
      },
    ]);
  });
});
