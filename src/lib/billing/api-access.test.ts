import { describe, expect, test } from "bun:test";

import { apiSunsetWarning, canUseApi, getApiAccess, parseApiSunset } from "./api-access";

import type { Subscription } from "@/server/db/schema";

const DAY = 24 * 60 * 60 * 1000;
const PRO_MONTHLY_VARIANT_ID = 1811616;
const SUNSET = new Date("2026-11-27T12:00:00Z");
const BEFORE = new Date(SUNSET.getTime() - 3 * DAY);
const AFTER = new Date(SUNSET.getTime() + 1000);

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 1,
    userId: "user_1",
    orderId: 10,
    subscriptionId: 100,
    customerId: 1000,
    renewsAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: null,
    status: "active",
    plan: "pro",
    billingInterval: "monthly",
    variantId: PRO_MONTHLY_VARIANT_ID,
    productId: 0,
    providerUpdatedAt: null,
    cardBrand: "visa",
    cardLastFour: "4242",
    ...overrides,
  };
}

describe("canUseApi", () => {
  test("only paid plans can use the API", () => {
    expect(canUseApi("free")).toBe(false);
    expect(canUseApi("pro")).toBe(true);
    expect(canUseApi("ultra")).toBe(true);
  });
});

describe("parseApiSunset", () => {
  test("parses ISO timestamps and ignores unset or invalid values", () => {
    expect(parseApiSunset("2026-11-27T12:00:00Z")?.toISOString()).toBe(SUNSET.toISOString());
    expect(parseApiSunset(undefined)).toBeNull();
    expect(parseApiSunset("")).toBeNull();
    expect(parseApiSunset("not a date")).toBeNull();
  });
});

describe("getApiAccess", () => {
  test("paid plans keep full access before and after the sunset", () => {
    expect(getApiAccess(sub({}), SUNSET, AFTER)).toEqual({ status: "full" });
    expect(getApiAccess(sub({ status: "on_trial" }), SUNSET, AFTER)).toEqual({ status: "full" });
  });

  test("free accounts keep full access while no sunset is configured", () => {
    expect(getApiAccess(null, null, AFTER)).toEqual({ status: "full" });
  });

  test("free accounts are sunsetting until the configured cutoff", () => {
    expect(getApiAccess(null, SUNSET, BEFORE)).toEqual({
      status: "sunsetting",
      deprecatedAt: new Date(SUNSET.getTime() - 7 * DAY),
      sunsetAt: SUNSET,
    });
  });

  test("free accounts are revoked from the cutoff on", () => {
    expect(getApiAccess(null, SUNSET, SUNSET)).toEqual({ status: "revoked", sunsetAt: SUNSET });
    expect(getApiAccess(null, SUNSET, AFTER)).toEqual({ status: "revoked", sunsetAt: SUNSET });
  });

  test("a free-plan subscription row with no paid history uses the configured cutoff", () => {
    const row = sub({ status: "", plan: "free", variantId: 0, endsAt: new Date(BEFORE) });
    expect(getApiAccess(row, SUNSET, AFTER)).toEqual({ status: "revoked", sunsetAt: SUNSET });
  });

  describe("lapsed accounts", () => {
    const endsAt = new Date(SUNSET.getTime() + 10 * DAY);
    const cancelled = sub({ status: "cancelled", endsAt });
    const lapsedSunset = new Date(endsAt.getTime() + 7 * DAY);

    test("keep full access until the paid period ends", () => {
      const now = new Date(endsAt.getTime() - 1000);
      expect(getApiAccess(cancelled, SUNSET, now)).toEqual({ status: "full" });
    });

    test("get 7 days on Free limits after the paid period ends", () => {
      const now = new Date(endsAt.getTime() + 2 * DAY);
      expect(getApiAccess(cancelled, SUNSET, now)).toEqual({
        status: "sunsetting",
        deprecatedAt: endsAt,
        sunsetAt: lapsedSunset,
      });
    });

    test("are revoked 7 days after the paid period ends", () => {
      expect(getApiAccess(cancelled, SUNSET, lapsedSunset)).toEqual({
        status: "revoked",
        sunsetAt: lapsedSunset,
      });
    });

    test("expired subscriptions count from the provider's last update", () => {
      const lapse = new Date(SUNSET.getTime() + DAY);
      const expired = sub({ status: "expired", providerUpdatedAt: lapse });
      const now = new Date(lapse.getTime() + DAY);
      expect(getApiAccess(expired, SUNSET, now)).toMatchObject({
        status: "sunsetting",
        sunsetAt: new Date(lapse.getTime() + 7 * DAY),
      });
    });

    test("expired subscriptions as the webhook stores them get 7 days from the lapse", () => {
      // subscription_expired resets plan and ids and stamps endsAt with the processing time.
      const lapse = new Date(SUNSET.getTime() + 13 * DAY);
      const expired = sub({
        status: "expired",
        plan: "free",
        variantId: 0,
        productId: 0,
        endsAt: lapse,
        providerUpdatedAt: lapse,
      });
      const lapseSunset = new Date(lapse.getTime() + 7 * DAY);
      expect(getApiAccess(expired, SUNSET, new Date(lapse.getTime() + 60_000))).toEqual({
        status: "sunsetting",
        deprecatedAt: lapse,
        sunsetAt: lapseSunset,
      });
      expect(getApiAccess(expired, SUNSET, lapseSunset)).toEqual({
        status: "revoked",
        sunsetAt: lapseSunset,
      });
    });

    test("a zeroed row with no provider subscription is not a lapse", () => {
      const row = sub({ status: "expired", plan: "free", variantId: 0, subscriptionId: 0 });
      expect(getApiAccess(row, SUNSET, AFTER)).toEqual({ status: "revoked", sunsetAt: SUNSET });
    });

    test("a lapse long before the cutoff still gets the configured cutoff", () => {
      const old = sub({ status: "expired", endsAt: new Date("2025-01-01T00:00:00Z") });
      expect(getApiAccess(old, SUNSET, BEFORE)).toMatchObject({
        status: "sunsetting",
        sunsetAt: SUNSET,
      });
    });
  });
});

describe("apiSunsetWarning", () => {
  test("names the cutoff date and the upgrade URL", () => {
    const warning = apiSunsetWarning(SUNSET);
    expect(warning).toContain("November 27, 2026");
    expect(warning).toContain("https://ishortn.ink/pricing");
  });
});
