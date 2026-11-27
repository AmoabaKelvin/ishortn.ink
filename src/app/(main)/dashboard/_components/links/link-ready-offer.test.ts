import { describe, expect, test } from "bun:test";

import { buildUpgradeUrl, getUpgradeReason } from "@/lib/billing/upgrade";

import {
  FIRST_LINK_OWN_DOMAIN_SOURCE,
  LINK_READY_SOURCE,
  linkReadyOffer,
  ownDomainOffer,
} from "./link-ready-offer";

const inPromo = new Date("2026-11-27T10:00:00Z");
const outOfPromo = new Date("2026-12-05T10:00:00Z");
const free = {
  plan: "free" as const,
  isTeamWorkspace: false,
  subscriptionMode: "checkout" as const,
  isRestricted: false,
};

describe("linkReadyOffer", () => {
  test("shows the promo offer to Free personal workspaces while the promo runs", () => {
    expect(linkReadyOffer({ subscription: free, now: inPromo })).toBe(
      "Black Friday: Pro is 20% off your first year until Tuesday 1 December.",
    );
  });

  test("shows the custom-domain pitch outside the promo window", () => {
    const expected =
      "Want links on your own domain? Custom domains and full click history are on Pro.";
    expect(linkReadyOffer({ subscription: free, now: outOfPromo })).toBe(expected);
    expect(linkReadyOffer({ subscription: free, now: new Date("2026-11-24T23:59:59Z") })).toBe(
      expected,
    );
  });

  test("is hidden for paying accounts, team workspaces and restricted accounts", () => {
    const pro = { ...free, plan: "pro" as const, subscriptionMode: "update" as const };
    const ultra = { ...pro, plan: "ultra" as const };
    const cancelledPro = { ...pro, subscriptionMode: "resume" as const };
    const team = { ...free, plan: "ultra" as const, isTeamWorkspace: true };
    const freeInTeam = { ...free, isTeamWorkspace: true };
    const restricted = { ...free, isRestricted: true };
    for (const subscription of [pro, ultra, cancelledPro, team, freeInTeam, restricted]) {
      for (const now of [inPromo, outOfPromo]) {
        expect(linkReadyOffer({ subscription, now })).toBeNull();
      }
    }
  });

  test("is hidden until the subscription has loaded", () => {
    expect(linkReadyOffer({ subscription: null, now: inPromo })).toBeNull();
  });
});

describe("ownDomainOffer", () => {
  const company = { ...free, companyEmailDomain: "acme.com" };

  test("offers go.<company domain> with the Pro annual price on the first link", () => {
    expect(ownDomainOffer({ subscription: company, isFirstLink: true, now: outOfPromo })).toEqual({
      title: "Put this on go.acme.com",
      detail: "Custom domains are on Pro: $80/year.",
      promo: null,
    });
  });

  test("states the first-year promo price while the promo runs", () => {
    const offer = ownDomainOffer({ subscription: company, isFirstLink: true, now: inPromo });
    expect(offer?.detail).toBe(
      "Custom domains are on Pro: $64 for your first year (Black Friday, 20% off), then $80/year.",
    );
    expect(offer?.promo?.code).toBe("BFCM20");
  });

  test("is hidden after the first link and for free-mail addresses", () => {
    expect(
      ownDomainOffer({ subscription: company, isFirstLink: false, now: outOfPromo }),
    ).toBeNull();
    const freeMail = { ...free, companyEmailDomain: null };
    expect(
      ownDomainOffer({ subscription: freeMail, isFirstLink: true, now: outOfPromo }),
    ).toBeNull();
  });

  test("is hidden wherever the plan line is hidden", () => {
    const pro = { ...company, plan: "pro" as const, subscriptionMode: "update" as const };
    const team = { ...company, isTeamWorkspace: true };
    const restricted = { ...company, isRestricted: true };
    for (const subscription of [pro, team, restricted, null]) {
      expect(ownDomainOffer({ subscription, isFirstLink: true, now: outOfPromo })).toBeNull();
    }
  });
});

describe("first_link_own_domain upgrade source", () => {
  test("leads to pricing with Pro highlighted and a reason line", () => {
    expect(buildUpgradeUrl("pro", FIRST_LINK_OWN_DOMAIN_SOURCE)).toBe(
      "/dashboard/pricing?highlight=pro&source=first_link_own_domain",
    );
    expect(getUpgradeReason(FIRST_LINK_OWN_DOMAIN_SOURCE, "pro")).toBe("Custom domains are on Pro");
  });
});

describe("link_ready upgrade source", () => {
  test("leads to pricing with Pro highlighted and a reason line", () => {
    expect(buildUpgradeUrl("pro", LINK_READY_SOURCE)).toBe(
      "/dashboard/pricing?highlight=pro&source=link_ready",
    );
    expect(getUpgradeReason(LINK_READY_SOURCE, "pro")).toBe(
      "Custom domains and full click history are on Pro",
    );
  });
});
