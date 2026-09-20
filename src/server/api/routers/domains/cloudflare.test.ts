import { describe, expect, it } from "bun:test";

import { isRetiredCustomHostname } from "./cloudflare";

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
