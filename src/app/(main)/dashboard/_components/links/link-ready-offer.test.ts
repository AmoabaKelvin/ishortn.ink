import { describe, expect, test } from "bun:test";

import { buildUpgradeUrl, getUpgradeReason } from "@/lib/billing/upgrade";

import { LINK_READY_SOURCE, linkReadyOffer } from "./link-ready-offer";

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
