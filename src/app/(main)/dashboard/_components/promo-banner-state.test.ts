import { describe, expect, test } from "bun:test";

import { ACTIVE_PROMO } from "@/lib/billing/promo";

import {
  graceOfferPromo,
  promoBannerHref,
  promoBannerState,
  promoDismissKey,
  upgradeOfferPromo,
} from "./promo-banner-state";

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

describe("upgradeOfferPromo", () => {
  test("offers the promo to Free personal workspaces inside the window", () => {
    expect(upgradeOfferPromo({ subscription: free, isRestricted: false, now: inside })).toBe(
      ACTIVE_PROMO,
    );
  });

  test("is null outside the window, for restricted accounts and for other subscriptions", () => {
    const after = new Date("2026-12-02T10:00:00Z");
    expect(upgradeOfferPromo({ subscription: free, isRestricted: false, now: after })).toBeNull();
    expect(upgradeOfferPromo({ subscription: free, isRestricted: true, now: inside })).toBeNull();
    expect(upgradeOfferPromo({ subscription: null, isRestricted: false, now: inside })).toBeNull();
    const resume = { ...free, subscriptionMode: "resume" as const };
    const team = { ...free, isTeamWorkspace: true };
    const pro = { ...free, plan: "pro" as const, subscriptionMode: "update" as const };
    for (const subscription of [resume, team, pro]) {
      expect(upgradeOfferPromo({ subscription, isRestricted: false, now: inside })).toBeNull();
    }
  });
});

describe("graceOfferPromo", () => {
  // A lapsed Pro account in grace: its plan still reads as Pro, but resubscribing is a new checkout.
  const lapsed = { ...free, plan: "pro" as const };
  const notice = {
    type: "account" as const,
    plan: "pro" as const,
    reason: "lapsed" as const,
    action: "upgrade" as const,
  };

  test("offers the promo to a lapsed account in grace inside the window", () => {
    expect(
      graceOfferPromo({ subscription: lapsed, notice, isRestricted: false, now: inside }),
    ).toBe(ACTIVE_PROMO);
    const ultra = { ...notice, plan: "ultra" as const };
    expect(
      graceOfferPromo({ subscription: lapsed, notice: ultra, isRestricted: false, now: inside }),
    ).toBe(ACTIVE_PROMO);
  });

  test("offers the promo to an account in an over-plan grace that would start a checkout", () => {
    const overPlan = { ...notice, reason: "over_plan" as const };
    expect(
      graceOfferPromo({ subscription: free, notice: overPlan, isRestricted: false, now: inside }),
    ).toBe(ACTIVE_PROMO);
  });

  test("is null outside the window", () => {
    const before = new Date("2026-11-24T10:00:00Z");
    const after = new Date("2026-12-02T10:00:00Z");
    for (const now of [before, after]) {
      expect(
        graceOfferPromo({ subscription: lapsed, notice, isRestricted: false, now }),
      ).toBeNull();
    }
  });

  test("is null without a grace notice, so Free accounts keep the strip only", () => {
    for (const n of [null, undefined]) {
      expect(
        graceOfferPromo({ subscription: free, notice: n, isRestricted: false, now: inside }),
      ).toBeNull();
    }
  });

  test("is null for a failed payment, which is fixed on the existing subscription", () => {
    const updateMode = { ...lapsed, subscriptionMode: "update" as const };
    for (const reason of ["lapsed", "over_plan"] as const) {
      const pastDue = { ...notice, reason, action: "update_payment" as const };
      // Also null if the subscription mode reads as checkout: the notice decides.
      for (const subscription of [updateMode, lapsed]) {
        expect(
          graceOfferPromo({ subscription, notice: pastDue, isRestricted: false, now: inside }),
        ).toBeNull();
      }
    }
  });

  test("is null when the account still has a subscription to change or resume", () => {
    for (const subscriptionMode of ["update", "resume"] as const) {
      expect(
        graceOfferPromo({
          subscription: { ...lapsed, subscriptionMode },
          notice,
          isRestricted: false,
          now: inside,
        }),
      ).toBeNull();
    }
  });

  test("is null for team notices, team workspaces and restricted accounts", () => {
    const team = { type: "team" as const };
    const cases = [
      { subscription: lapsed, notice: team, isRestricted: false },
      { subscription: { ...lapsed, isTeamWorkspace: true }, notice, isRestricted: false },
      { subscription: lapsed, notice, isRestricted: true },
      { subscription: null, notice, isRestricted: false },
    ];
    for (const input of cases) {
      expect(graceOfferPromo({ ...input, now: inside })).toBeNull();
    }
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
