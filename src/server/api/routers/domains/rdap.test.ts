import { describe, expect, it } from "bun:test";

import { lookupDomainRegistration, reviewNewDomain } from "./rdap";

import type { DomainRegistration } from "./utils";

const NOW = new Date("2026-11-22T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

function lookupReturning(registration: DomainRegistration | null) {
  const calls: string[] = [];
  const lookupRegistration = async (domain: string) => {
    calls.push(domain);
    return registration;
  };
  return { calls, lookupRegistration };
}

describe("reviewNewDomain", () => {
  it("holds a recently registered domain added by a new account", async () => {
    const { calls, lookupRegistration } = lookupReturning({
      registeredAt: daysAgo(21),
      registrar: "NameCheap, Inc.",
    });

    const review = await reviewNewDomain("login.acmme-corp.co.uk", daysAgo(1), {
      lookupRegistration,
      now: NOW,
    });

    // Looked up by registrable domain, resolved with the public suffix list
    expect(calls).toEqual(["acmme-corp.co.uk"]);
    expect(review).toEqual({
      reviewStatus: "held",
      reviewReason: "Account 1 day old; domain registered 21 days ago",
      registrableDomainRegisteredAt: daysAgo(21),
      registrar: "NameCheap, Inc.",
      rdapLookupFailed: false,
    });
  });

  it("doesn't hold or look up domains added by accounts older than 14 days", async () => {
    const { calls, lookupRegistration } = lookupReturning({
      registeredAt: daysAgo(1),
      registrar: null,
    });

    const review = await reviewNewDomain("links.example.com", daysAgo(14), {
      lookupRegistration,
      now: NOW,
    });

    expect(calls).toEqual([]);
    expect(review.reviewStatus).toBeNull();
    expect(review.rdapLookupFailed).toBe(false);
  });

  it("doesn't hold a domain registered 120 or more days ago", async () => {
    const { lookupRegistration } = lookupReturning({
      registeredAt: daysAgo(120),
      registrar: "MarkMonitor Inc.",
    });

    const review = await reviewNewDomain("go.example.com", daysAgo(2), {
      lookupRegistration,
      now: NOW,
    });

    expect(review.reviewStatus).toBeNull();
    expect(review.reviewReason).toBeNull();
    // The lookup result is still kept for reference
    expect(review.registrableDomainRegisteredAt).toEqual(daysAgo(120));
    expect(review.registrar).toBe("MarkMonitor Inc.");
  });

  it("doesn't hold when the RDAP lookup fails, and records the failure", async () => {
    const { lookupRegistration } = lookupReturning(null);

    const review = await reviewNewDomain("links.example.com", daysAgo(1), {
      lookupRegistration,
      now: NOW,
    });

    expect(review.reviewStatus).toBeNull();
    expect(review.rdapLookupFailed).toBe(true);
  });
});

type RdapBody = {
  events?: { eventAction: string; eventDate: string }[];
  entities?: { roles: string[]; vcardArray: (string | (string | Record<string, never>)[][])[] }[];
};

describe("lookupDomainRegistration", () => {
  const respond = (status: number, body: RdapBody) => async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/rdap+json" },
    });

  it("reads the registration date and registrar", async () => {
    const result = await lookupDomainRegistration(
      "example.com",
      respond(200, {
        events: [{ eventAction: "registration", eventDate: "2026-10-01T08:00:00Z" }],
        entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["fn", {}, "text", "Reg"]]] }],
      }),
    );
    expect(result).toEqual({ registeredAt: new Date("2026-10-01T08:00:00Z"), registrar: "Reg" });
  });

  it("returns null for error responses, network failures and timeouts", async () => {
    expect(await lookupDomainRegistration("example.zz", respond(404, {}))).toBeNull();

    const failing = async (): Promise<Response> => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    };
    expect(await lookupDomainRegistration("example.com", failing)).toBeNull();
  });
});
