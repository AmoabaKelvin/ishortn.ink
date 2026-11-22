import { describe, expect, it } from "bun:test";

import { createCustomDomainSchema } from "./domains.input";
import {
  isWithinDays,
  normalizeDomainInput,
  rdapDomainSchema,
  registrationFromRdap,
} from "./utils";

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

// Loose on purpose: fixtures include the malformed shapes registries send
type RdapFixture =
  | string
  | {
      events?: { eventAction: string; eventDate: string }[];
      entities?: { roles: string[]; vcardArray?: string | (string | string[][] | JCardRow[])[] }[];
    };
type JCardRow = (string | Record<string, never>)[];

describe("registrationFromRdap", () => {
  const parseRdapRegistration = (fixture: RdapFixture) => {
    const parsed = rdapDomainSchema.safeParse(fixture);
    return parsed.success ? registrationFromRdap(parsed.data) : null;
  };

  const registrarEntity = {
    roles: ["registrar"],
    vcardArray: [
      "vcard",
      [
        ["version", {}, "text", "4.0"],
        ["fn", {}, "text", "NameCheap, Inc."],
      ],
    ],
  };

  it("reads the registration event and the registrar's name", () => {
    expect(
      parseRdapRegistration({
        events: [
          { eventAction: "expiration", eventDate: "2027-10-01T00:00:00Z" },
          { eventAction: "registration", eventDate: "2026-10-01T08:30:00Z" },
        ],
        entities: [{ roles: ["registrant"] }, registrarEntity],
      }),
    ).toEqual({ registeredAt: new Date("2026-10-01T08:30:00Z"), registrar: "NameCheap, Inc." });
  });

  it("keeps the date when the registrar is missing or malformed", () => {
    expect(
      parseRdapRegistration({
        events: [{ eventAction: "registration", eventDate: "2026-10-01T00:00:00Z" }],
        entities: [{ roles: ["registrar"], vcardArray: "nope" }],
      }),
    ).toEqual({ registeredAt: new Date("2026-10-01T00:00:00Z"), registrar: null });
  });

  it("returns null without a usable registration date", () => {
    expect(parseRdapRegistration({ entities: [registrarEntity] })).toBeNull();
    expect(
      parseRdapRegistration({ events: [{ eventAction: "registration", eventDate: "soon" }] }),
    ).toBeNull();
    expect(parseRdapRegistration("<html>")).toBeNull();
    expect(parseRdapRegistration(null)).toBeNull();
  });
});

describe("isWithinDays", () => {
  const now = new Date("2026-11-22T00:00:00Z");

  it("is true strictly inside the window", () => {
    expect(isWithinDays(new Date("2026-11-09T00:00:01Z"), 14, now)).toBe(true);
    expect(isWithinDays(new Date("2026-11-08T00:00:00Z"), 14, now)).toBe(false);
  });
});
