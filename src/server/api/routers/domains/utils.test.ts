import { describe, expect, it } from "bun:test";

import { createCustomDomainSchema } from "./domains.input";
import { normalizeDomainInput } from "./utils";

describe("normalizeDomainInput", () => {
  it("reduces a pasted URL to a lowercase hostname", () => {
    expect(normalizeDomainInput("HTTPS://Links.Example.com/ ")).toBe("links.example.com");
    expect(normalizeDomainInput("  http://example.com//")).toBe("example.com");
    expect(normalizeDomainInput("example.com.")).toBe("example.com");
  });

  it("keeps www and never strips it from inside a name", () => {
    expect(normalizeDomainInput("www.example.com")).toBe("www.example.com");
    expect(normalizeDomainInput("awww.io")).toBe("awww.io");
  });

  it("converts internationalised names to punycode", () => {
    expect(normalizeDomainInput("Bücher.de")).toBe("xn--bcher-kva.de");
  });
});

describe("createCustomDomainSchema", () => {
  const parse = (domain: string) => createCustomDomainSchema.safeParse({ domain });

  it("accepts hostnames and returns them normalised", () => {
    expect(parse("HTTPS://Links.Example.com/ ")).toEqual({
      success: true,
      data: { domain: "links.example.com" },
    });
    expect(parse("awww.io").data?.domain).toBe("awww.io");
    expect(parse("links.acme.co.uk").data?.domain).toBe("links.acme.co.uk");
  });

  it("rejects paths, ports and non-hostnames", () => {
    for (const domain of [
      "",
      "   ",
      "example.com/links",
      "example.com:8080",
      "https://example.com/path?q=1",
      "localhost",
      "exa mple.com",
      "-bad.example.com",
      "under_score.example.com",
      "user@example.com",
    ]) {
      expect(parse(domain).success).toBe(false);
    }
  });
});
