import { describe, expect, test } from "bun:test";

import { PLAN_VARIANT_IDS } from "@/lib/billing/plans";

import { annualSwitchDismissKey, annualSwitchOffer } from "./annual-switch-state";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-22T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

const monthlyPro = {
  userId: "user_1",
  status: "active",
  variantId: PLAN_VARIANT_IDS.pro.monthly,
  billingInterval: "monthly" as const,
  createdAt: daysAgo(90),
};

const base = {
  subscription: monthlyPro,
  isTeamWorkspace: false,
  restricted: false,
  graceActive: false,
  otherBannerShown: false,
  dismissedAt: null,
  now,
};

describe("annualSwitchOffer", () => {
  test("offers annual Pro to a monthly $8 Pro subscriber older than 30 days", () => {
    expect(annualSwitchOffer(base)).toEqual({
      userId: "user_1",
      plan: "pro",
      annualPrice: 80,
      monthlyYearTotal: 96,
      saving: 16,
    });
  });

  test("offers annual Ultra to a monthly Ultra subscriber", () => {
    const subscription = { ...monthlyPro, variantId: PLAN_VARIANT_IDS.ultra.monthly };
    expect(annualSwitchOffer({ ...base, subscription })).toMatchObject({
      plan: "ultra",
      annualPrice: 150,
      monthlyYearTotal: 180,
      saving: 30,
    });
  });

  test("is hidden for the legacy $5 Pro variant", () => {
    const subscription = { ...monthlyPro, variantId: 441105 };
    expect(annualSwitchOffer({ ...base, subscription })).toBeNull();
  });

  test("is hidden for annual subscribers", () => {
    const subscription = {
      ...monthlyPro,
      variantId: PLAN_VARIANT_IDS.ultra.annual,
      billingInterval: "annual" as const,
    };
    expect(annualSwitchOffer({ ...base, subscription })).toBeNull();
  });

  test("is hidden unless the subscription is active", () => {
    for (const status of ["past_due", "unpaid", "cancelled", "on_trial"]) {
      const subscription = { ...monthlyPro, status };
      expect(annualSwitchOffer({ ...base, subscription })).toBeNull();
    }
  });

  test("is hidden for subscriptions under 30 days old", () => {
    const subscription = { ...monthlyPro, createdAt: daysAgo(10) };
    expect(annualSwitchOffer({ ...base, subscription })).toBeNull();
    expect(
      annualSwitchOffer({ ...base, subscription: { ...monthlyPro, createdAt: null } }),
    ).toBeNull();
  });

  test("is hidden during plan grace, for restricted accounts and beside another banner", () => {
    expect(annualSwitchOffer({ ...base, graceActive: true })).toBeNull();
    expect(annualSwitchOffer({ ...base, restricted: true })).toBeNull();
    expect(annualSwitchOffer({ ...base, otherBannerShown: true })).toBeNull();
  });

  test("is hidden for Free users and team workspaces", () => {
    expect(annualSwitchOffer({ ...base, subscription: null })).toBeNull();
    const freeRow = { ...monthlyPro, status: "", variantId: 0 };
    expect(annualSwitchOffer({ ...base, subscription: freeRow })).toBeNull();
    expect(annualSwitchOffer({ ...base, isTeamWorkspace: true })).toBeNull();
  });

  test("stays hidden for 60 days after a dismissal", () => {
    expect(annualSwitchOffer({ ...base, dismissedAt: daysAgo(5).getTime() })).toBeNull();
    expect(annualSwitchOffer({ ...base, dismissedAt: daysAgo(61).getTime() })).not.toBeNull();
  });
});

describe("annualSwitchDismissKey", () => {
  test("is scoped to the user", () => {
    expect(annualSwitchDismissKey("user_1")).toBe("ishortn:annual-switch-dismissed:user_1");
  });

  describe("Paddle rows", () => {
    const paddleMonthlyPriceIds = { pro: "pri_pro_monthly", ultra: "pri_ultra_monthly" };
    const paddlePro = {
      ...monthlyPro,
      variantId: 0,
      billingProvider: "paddle",
      providerPriceId: "pri_pro_monthly",
    };

    test("offers annual Pro on the configured Pro monthly price", () => {
      expect(
        annualSwitchOffer({ ...base, subscription: paddlePro, paddleMonthlyPriceIds }),
      ).toMatchObject({ plan: "pro", saving: 16 });
    });

    test("offers annual Ultra on the configured Ultra monthly price", () => {
      const subscription = { ...paddlePro, providerPriceId: "pri_ultra_monthly" };
      expect(annualSwitchOffer({ ...base, subscription, paddleMonthlyPriceIds })).toMatchObject({
        plan: "ultra",
      });
    });

    test("is hidden for a legacy or unknown price", () => {
      const subscription = { ...paddlePro, providerPriceId: "pri_pro_legacy_monthly" };
      expect(annualSwitchOffer({ ...base, subscription, paddleMonthlyPriceIds })).toBeNull();
    });

    test("is hidden when Paddle isn't configured or the row has no price", () => {
      expect(
        annualSwitchOffer({
          ...base,
          subscription: { ...paddlePro, providerPriceId: null },
          paddleMonthlyPriceIds: { pro: null, ultra: null },
        }),
      ).toBeNull();
      expect(annualSwitchOffer({ ...base, subscription: paddlePro })).toBeNull();
    });

    test("ignores a Lemon Squeezy variant on a Paddle row", () => {
      const subscription = {
        ...paddlePro,
        variantId: PLAN_VARIANT_IDS.pro.monthly,
        providerPriceId: null,
      };
      expect(annualSwitchOffer({ ...base, subscription, paddleMonthlyPriceIds })).toBeNull();
    });
  });
});
