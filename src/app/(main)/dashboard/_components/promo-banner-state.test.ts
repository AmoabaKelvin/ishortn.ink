import { describe, expect, test } from "bun:test";

import { ACTIVE_PROMO } from "@/lib/billing/promo";

import { promoBannerHref, promoBannerState, promoDismissKey } from "./promo-banner-state";

const inside = new Date("2026-11-27T10:00:00Z");
const free = {
  plan: "free" as const,
  isTeamWorkspace: false,
  subscriptionMode: "checkout" as const,
};

describe("promoBannerState", () => {
  test("shows the promo to Free personal workspaces inside the window", () => {
    expect(promoBannerState({ subscription: free, otherBannerShown: false, now: inside })).toBe(
      ACTIVE_PROMO,
    );
  });

  test("is hidden outside the window", () => {
    const before = new Date("2026-11-24T10:00:00Z");
    const after = new Date("2026-12-02T10:00:00Z");
    expect(
      promoBannerState({ subscription: free, otherBannerShown: false, now: before }),
    ).toBeNull();
    expect(
      promoBannerState({ subscription: free, otherBannerShown: false, now: after }),
    ).toBeNull();
  });

  test("is hidden for paying users and team workspaces", () => {
    const pro = {
      plan: "pro" as const,
      isTeamWorkspace: false,
      subscriptionMode: "update" as const,
    };
    const cancelledPro = { ...pro, subscriptionMode: "resume" as const };
    const team = {
      plan: "ultra" as const,
      isTeamWorkspace: true,
      subscriptionMode: "checkout" as const,
    };
    for (const subscription of [pro, cancelledPro, team]) {
      expect(promoBannerState({ subscription, otherBannerShown: false, now: inside })).toBeNull();
    }
  });

  test("never stacks with another account banner", () => {
    expect(
      promoBannerState({ subscription: free, otherBannerShown: true, now: inside }),
    ).toBeNull();
  });

  test("is hidden when the subscription could not be loaded", () => {
    expect(
      promoBannerState({ subscription: null, otherBannerShown: false, now: inside }),
    ).toBeNull();
  });
});

describe("promoBannerHref", () => {
  test("links to dashboard pricing with the campaign UTMs", () => {
    expect(promoBannerHref(ACTIVE_PROMO)).toBe(
      "/dashboard/pricing?utm_source=app&utm_medium=banner&utm_campaign=bfcm2026",
    );
  });
});

describe("promoDismissKey", () => {
  test("is scoped to the promo code", () => {
    expect(promoDismissKey(ACTIVE_PROMO)).toBe("ishortn:promo-dismissed:BFCM20");
  });
});
