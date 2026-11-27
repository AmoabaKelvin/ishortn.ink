import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";
import { addMonths } from "date-fns";
import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { STALE_BILLING_MESSAGE } from "@/lib/billing/plan-change-copy";
import { ACTIVE_PROMO } from "@/lib/billing/promo";
import { PaddleApiError } from "@/lib/paddle/client";
import { buildPaddleConfig } from "@/lib/paddle/config";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { stubCloudflareContext } from "../../../../../test/cloudflare-context";
import { createLemonsqueezyRouter } from "./lemonsqueezy.procedure";

import type { TRPCContext } from "../../trpc";
import type { PaddleDeps } from "./lemonsqueezy.procedure";
import type { PaddleSubscription } from "@/lib/paddle/client";
import type { Mock } from "bun:test";

// Subscription management for Paddle rows against a real MySQL, with Paddle answered by a stubbed
// client. Set TEST_DATABASE_URL to run it; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const USER_ID = "paddle_manage_test";
const SUBSCRIPTION_ID = "sub_01managetest935";
const CUSTOMER_ID = "ctm_01managetest935";
const PRICES = {
  proMonthly: "pri_01pro_monthly",
  proAnnual: "pri_01pro_annual",
  ultraMonthly: "pri_01ultra_monthly",
  ultraAnnual: "pri_01ultra_annual",
};
const DAY = 24 * 60 * 60 * 1000;
const PERIOD_END = "2027-01-15T10:00:00.000Z";
const PORTAL = {
  overview: "https://customer-portal.paddle.test/overview",
  paymentMethod: "https://customer-portal.paddle.test/payment-method",
};

const config = buildPaddleConfig({
  BILLING_PROVIDER: undefined,
  PADDLE_ENVIRONMENT: "sandbox",
  PADDLE_API_KEY: "pdl_sdbx_manage_test",
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_manage_test",
  PADDLE_CLIENT_TOKEN: "test_manage_test",
  PADDLE_PRICE_PRO_MONTHLY: PRICES.proMonthly,
  PADDLE_PRICE_PRO_ANNUAL: PRICES.proAnnual,
  PADDLE_PRICE_ULTRA_MONTHLY: PRICES.ultraMonthly,
  PADDLE_PRICE_ULTRA_ANNUAL: PRICES.ultraAnnual,
  PADDLE_PRICE_PRO_LEGACY_MONTHLY: undefined,
  PADDLE_CHECKOUT_USER_IDS: undefined,
});

type Call = [method: string, ...args: (string | string[] | object)[]];

describe.skipIf(!testDatabaseUrl)("subscription management for Paddle rows (MySQL)", () => {
  let restoreContext: () => void;
  let fetchSpy: Mock<typeof fetch>;
  let calls: Call[];
  let updatedAt = Date.now();
  // What the stubbed Paddle answers with; a PaddleApiError is thrown instead of returned.
  let respond: (method: string) => PaddleSubscription | PaddleApiError;
  let portalFails = false;
  let discountFails = false;
  let previewFails = false;

  function paddleSub(overrides: Partial<PaddleSubscription> = {}): PaddleSubscription {
    updatedAt += 1000;
    return {
      id: SUBSCRIPTION_ID,
      status: "active",
      customer_id: CUSTOMER_ID,
      items: [{ price: { id: PRICES.proMonthly } }],
      scheduled_change: null,
      current_billing_period: { starts_at: "2026-12-15T10:00:00.000Z", ends_at: PERIOD_END },
      next_billed_at: PERIOD_END,
      started_at: "2026-10-15T10:00:00.000Z",
      created_at: "2026-10-15T10:00:00.000Z",
      updated_at: new Date(updatedAt).toISOString(),
      custom_data: null,
      ...overrides,
    };
  }

  function answer(method: string) {
    const result = respond(method);
    if (result instanceof PaddleApiError) throw result;
    return result;
  }

  const paddleError = (status: number) =>
    new PaddleApiError({
      method: "PATCH",
      path: `/subscriptions/${SUBSCRIPTION_ID}`,
      status,
      code: "subscription_locked_renewal",
      detail: "Subscription is locked while it renews",
      requestId: null,
    });

  const client: PaddleDeps["client"] = {
    getSubscription: async (id) => {
      calls.push(["getSubscription", id]);
      return answer("getSubscription");
    },
    updateSubscription: async (id, input) => {
      calls.push(["updateSubscription", id, input]);
      return answer("updateSubscription");
    },
    previewSubscriptionUpdate: async (id, input) => {
      calls.push(["previewSubscriptionUpdate", id, input]);
      if (previewFails) throw paddleError(500);
      return {
        immediate_transaction: {
          details: { totals: { grand_total: "609", currency_code: "USD" } },
        },
      };
    },
    cancelSubscription: async (id, effectiveFrom) => {
      calls.push(["cancelSubscription", id, effectiveFrom]);
      return answer("cancelSubscription");
    },
    pauseSubscription: async (id, input) => {
      calls.push(["pauseSubscription", id, input]);
      return answer("pauseSubscription");
    },
    resumeSubscription: async (id, effectiveFrom) => {
      calls.push(["resumeSubscription", id, effectiveFrom]);
      return answer("resumeSubscription");
    },
    getUpdatePaymentMethodTransaction: async (id) => {
      calls.push(["getUpdatePaymentMethodTransaction", id]);
      return { id: "txn_01update", checkout: { url: "https://pay.paddle.test/txn_01update" } };
    },
    createDiscount: async (input) => {
      calls.push(["createDiscount", input]);
      if (discountFails) throw paddleError(500);
      return {
        id: "dsc_01firstyear",
        recur: true,
        maximum_recurring_intervals: input.maximumRecurringIntervals,
      };
    },
    archiveDiscount: async (id) => {
      calls.push(["archiveDiscount", id]);
      return { id, recur: false, maximum_recurring_intervals: null };
    },
    createPortalSession: async (customerId, subscriptionIds) => {
      calls.push(["createPortalSession", customerId, subscriptionIds]);
      if (portalFails) throw paddleError(500);
      return {
        urls: {
          general: { overview: PORTAL.overview },
          subscriptions: [
            {
              id: SUBSCRIPTION_ID,
              cancel_subscription: "https://customer-portal.paddle.test/cancel",
              update_subscription_payment_method: PORTAL.paymentMethod,
            },
          ],
        },
      };
    },
  };

  function caller(paddle: PaddleDeps | null = config && { client, config }) {
    // SAFETY: the procedures under test read only ctx.auth.userId from auth.
    const auth = { userId: USER_ID } as TRPCContext["auth"];
    return createLemonsqueezyRouter({ paddle: () => paddle }).createCaller({
      db,
      auth,
      headers: new Headers(),
    });
  }

  async function seed(subscription: Partial<typeof schema.subscription.$inferInsert> = {}) {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      billingProvider: "paddle",
      subscriptionId: 0,
      customerId: 0,
      variantId: 0,
      providerSubscriptionId: SUBSCRIPTION_ID,
      providerCustomerId: CUSTOMER_ID,
      providerPriceId: PRICES.proMonthly,
      status: "active",
      plan: "pro",
      billingInterval: "monthly",
      renewsAt: new Date(PERIOD_END),
      ...subscription,
    });
  }

  const stored = () =>
    db.query.subscription.findFirst({ where: eq(schema.subscription.userId, USER_ID) });
  const cancellations = () =>
    db.query.subscriptionCancellation.findMany({
      where: eq(schema.subscriptionCancellation.userId, USER_ID),
    });

  async function cleanup() {
    await db.delete(schema.checkoutStart).where(eq(schema.checkoutStart.userId, USER_ID));
    await db
      .delete(schema.subscriptionCancellation)
      .where(eq(schema.subscriptionCancellation.userId, USER_ID));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    Object.assign(env, {
      LEMONSQUEEZY_API_KEY: "test-key",
      LEMONSQUEEZY_STORE_ID: "1",
      LEMONSQUEEZY_WEBHOOK_SECRET: "test-secret",
      DISCORD_WEBHOOK_URL: undefined,
    });
    lemonSqueezySetup({ apiKey: "test-key" });
    restoreContext = stubCloudflareContext();
    // Lemon Squeezy calls go through fetch; any Paddle row reaching it fails the test.
    fetchSpy = spyOn(globalThis, "fetch");
  });

  beforeEach(async () => {
    calls = [];
    portalFails = false;
    discountFails = false;
    previewFails = false;
    respond = () => paddleSub();
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async () => Response.json({ errors: [] }, { status: 500 }));
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID, email: `${USER_ID}@example.com` });
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    restoreContext();
    await cleanup();
  });

  test("an upgrade changes the price now and charges the prorated difference", async () => {
    await seed();
    respond = () => paddleSub({ items: [{ price: { id: PRICES.ultraMonthly } }] });

    const result = await caller().createCheckoutOrUpdate({ plan: "ultra", interval: "monthly" });

    expect(result).toEqual({ status: "updated", message: "Plan updated successfully!" });
    expect(calls).toEqual([
      [
        "updateSubscription",
        SUBSCRIPTION_ID,
        {
          items: [{ priceId: PRICES.ultraMonthly, quantity: 1 }],
          prorationBillingMode: "prorated_immediately",
        },
      ],
    ]);
    expect(await stored()).toMatchObject({
      plan: "ultra",
      billingInterval: "monthly",
      providerPriceId: PRICES.ultraMonthly,
      status: "active",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("previewPlanChange quotes Paddle's prorated, discounted amount due today", async () => {
    await seed();

    const charge = await caller().previewPlanChange({ plan: "pro", interval: "annual" });

    expect(charge).toEqual({ type: "amount_due", amount: 609, currencyCode: "USD" });
    expect(calls).toEqual([
      [
        "previewSubscriptionUpdate",
        SUBSCRIPTION_ID,
        {
          items: [{ priceId: PRICES.proAnnual, quantity: 1 }],
          prorationBillingMode: "prorated_immediately",
        },
      ],
    ]);
  });

  test("previewPlanChange falls back to prorated wording when the preview fails", async () => {
    await seed();
    previewFails = true;

    expect(await caller().previewPlanChange({ plan: "ultra", interval: "monthly" })).toEqual({
      type: "prorated",
    });
    expect(await caller(null).previewPlanChange({ plan: "ultra", interval: "monthly" })).toEqual({
      type: "prorated",
    });
  });

  test("previewPlanChange quotes the list price for a Lemon Squeezy row", async () => {
    await seed({
      billingProvider: "lemonsqueezy",
      subscriptionId: 935001,
      providerSubscriptionId: null,
    });

    expect(await caller().previewPlanChange({ plan: "ultra", interval: "monthly" })).toEqual({
      type: "list_price",
    });
    expect(calls).toHaveLength(0);
  });

  test("an interval change stores the new interval and price", async () => {
    await seed();
    respond = () => paddleSub({ items: [{ price: { id: PRICES.proAnnual } }] });

    await caller().createCheckoutOrUpdate({ plan: "pro", interval: "annual" });

    expect(calls[0]?.[2]).toMatchObject({ items: [{ priceId: PRICES.proAnnual, quantity: 1 }] });
    expect(await stored()).toMatchObject({
      plan: "pro",
      billingInterval: "annual",
      providerPriceId: PRICES.proAnnual,
    });
  });

  describe("a subscription started with the first-year promo", () => {
    // A few days into the billing month `month` (0 is the first payment's month).
    const inBillingMonth = (month: number) =>
      new Date(addMonths(new Date(), -month).getTime() - 3 * DAY);

    async function seedPromo(
      billingMonth: number,
      subscription: Partial<typeof schema.subscription.$inferInsert> = {},
      checkoutInterval: "monthly" | "annual" = "monthly",
      promoCode = "BFCM20",
    ) {
      const createdAt = inBillingMonth(billingMonth);
      await db.insert(schema.checkoutStart).values({
        userId: USER_ID,
        plan: "pro",
        interval: checkoutInterval,
        promoCode,
        provider: "paddle",
        createdAt: new Date(createdAt.getTime() - 60_000),
      });
      await seed({ createdAt, ...subscription });
    }

    const discountCall = () => calls.find(([method]) => method === "createDiscount")?.[1];
    const updateCall = () => calls.find(([method]) => method === "updateSubscription")?.[2];

    test("Pro to Ultra on monthly carries the discount over the rest of the first year", async () => {
      // Months 3 to 11 are left, the current one included.
      await seedPromo(3);
      respond = () => paddleSub({ items: [{ price: { id: PRICES.ultraMonthly } }] });

      await caller().createCheckoutOrUpdate({ plan: "ultra", interval: "monthly" });

      expect(discountCall()).toMatchObject({ percentOff: 20, maximumRecurringIntervals: 9 });
      expect(updateCall()).toEqual({
        items: [{ priceId: PRICES.ultraMonthly, quantity: 1 }],
        prorationBillingMode: "prorated_immediately",
        discount: { id: "dsc_01firstyear", effectiveFrom: "immediately" },
      });
    });

    test("monthly to annual in the first year discounts that annual payment once", async () => {
      // Paddle rejects one-off discounts on subscription updates; one recurrence covers the
      // annual charge and leaves the next renewal at full price.
      await seedPromo(5);
      respond = () => paddleSub({ items: [{ price: { id: PRICES.proAnnual } }] });

      await caller().createCheckoutOrUpdate({ plan: "pro", interval: "annual" });

      expect(discountCall()).toMatchObject({ percentOff: 20, maximumRecurringIntervals: 1 });
      expect(updateCall()).toEqual({
        items: [{ priceId: PRICES.proAnnual, quantity: 1 }],
        prorationBillingMode: "prorated_immediately",
        discount: { id: "dsc_01firstyear", effectiveFrom: "immediately" },
      });
    });

    test("the monthly to annual preview carries the same discount, then archives it", async () => {
      await seedPromo(5);

      const charge = await caller().previewPlanChange({ plan: "pro", interval: "annual" });

      expect(charge).toEqual({ type: "amount_due", amount: 609, currencyCode: "USD" });
      expect(calls).toEqual([
        [
          "createDiscount",
          expect.objectContaining({ percentOff: 20, maximumRecurringIntervals: 1 }),
        ],
        [
          "previewSubscriptionUpdate",
          SUBSCRIPTION_ID,
          {
            items: [{ priceId: PRICES.proAnnual, quantity: 1 }],
            prorationBillingMode: "prorated_immediately",
            discount: { id: "dsc_01firstyear", effectiveFrom: "immediately" },
          },
        ],
        ["archiveDiscount", "dsc_01firstyear"],
      ]);
      expect(await stored()).toMatchObject({
        billingInterval: "monthly",
        promoDiscountEndedAt: null,
      });
    });

    test("a failed preview still archives the discount created for it", async () => {
      await seedPromo(5);
      previewFails = true;

      expect(await caller().previewPlanChange({ plan: "pro", interval: "annual" })).toEqual({
        type: "prorated",
      });
      expect(calls.map(([method]) => method)).toEqual([
        "createDiscount",
        "previewSubscriptionUpdate",
        "archiveDiscount",
      ]);
    });

    test("a preview after the first year previews the discount's removal", async () => {
      await seedPromo(13);

      await caller().previewPlanChange({ plan: "pro", interval: "annual" });

      expect(calls).toEqual([
        [
          "previewSubscriptionUpdate",
          SUBSCRIPTION_ID,
          {
            items: [{ priceId: PRICES.proAnnual, quantity: 1 }],
            prorationBillingMode: "prorated_immediately",
            discount: null,
          },
        ],
      ]);
    });

    test("an annual Pro to Ultra upgrade discounts its prorated charge with one recurrence", async () => {
      await seedPromo(
        2,
        { providerPriceId: PRICES.proAnnual, billingInterval: "annual" },
        "annual",
      );
      respond = () => paddleSub({ items: [{ price: { id: PRICES.ultraAnnual } }] });

      await caller().createCheckoutOrUpdate({ plan: "ultra", interval: "annual" });

      expect(discountCall()).toMatchObject({ maximumRecurringIntervals: 1 });
      expect(updateCall()).toMatchObject({
        discount: { id: "dsc_01firstyear", effectiveFrom: "immediately" },
      });
    });

    test("a returning customer counts the first year from the promo checkout", async () => {
      // The reused Subscription row keeps the first subscription's createdAt.
      await seedPromo(1);
      await db
        .update(schema.subscription)
        .set({ createdAt: addMonths(new Date(), -33) })
        .where(eq(schema.subscription.userId, USER_ID));
      respond = () => paddleSub({ items: [{ price: { id: PRICES.ultraMonthly } }] });

      await caller().createCheckoutOrUpdate({ plan: "ultra", interval: "monthly" });

      expect(discountCall()).toMatchObject({ maximumRecurringIntervals: 11 });
      expect(updateCall()).toMatchObject({
        discount: { id: "dsc_01firstyear", effectiveFrom: "immediately" },
      });
    });

    test("a failed discount create still changes the plan and leaves the discount", async () => {
      await seedPromo(3);
      discountFails = true;
      respond = () => paddleSub({ items: [{ price: { id: PRICES.ultraMonthly } }] });

      await caller().createCheckoutOrUpdate({ plan: "ultra", interval: "monthly" });

      expect(updateCall()).toEqual({
        items: [{ priceId: PRICES.ultraMonthly, quantity: 1 }],
        prorationBillingMode: "prorated_immediately",
      });
    });

    test("a failed discount create fails a change to annual, which would recur yearly", async () => {
      await seedPromo(5);
      discountFails = true;

      await expect(
        caller().createCheckoutOrUpdate({ plan: "pro", interval: "annual" }),
      ).rejects.toThrow();

      expect(updateCall()).toBeUndefined();
      expect(await stored()).toMatchObject({ billingInterval: "monthly" });
    });

    test("a failed plan change archives the discount created for it", async () => {
      await seedPromo(3);
      respond = (method) => (method === "updateSubscription" ? paddleError(400) : paddleSub());

      await expect(
        caller().createCheckoutOrUpdate({ plan: "ultra", interval: "monthly" }),
      ).rejects.toThrow();

      expect(calls.map(([method]) => method)).toEqual([
        "createDiscount",
        "updateSubscription",
        "archiveDiscount",
      ]);
      expect(calls[2]).toEqual(["archiveDiscount", "dsc_01firstyear"]);
      expect(await stored()).toMatchObject({ plan: "pro", promoDiscountEndedAt: null });
    });

    test("a monthly downgrade to Pro keeps it for the rest of the first year", async () => {
      await seedPromo(3, { plan: "ultra", providerPriceId: PRICES.ultraMonthly });
      respond = () => paddleSub();

      await caller().downgradeWithFeedback({ targetPlan: "pro", reason: "too_expensive" });

      expect(discountCall()).toMatchObject({ maximumRecurringIntervals: 9 });
      expect(updateCall()).toMatchObject({
        prorationBillingMode: "prorated_immediately",
        discount: { id: "dsc_01firstyear", effectiveFrom: "immediately" },
      });
    });

    test("a change after month 12 removes the discount", async () => {
      await seedPromo(13);
      respond = () => paddleSub({ items: [{ price: { id: PRICES.ultraAnnual } }] });

      await caller().createCheckoutOrUpdate({ plan: "ultra", interval: "annual" });

      expect(discountCall()).toBeUndefined();
      expect(updateCall()).toMatchObject({ discount: null });
    });

    test("annual to monthly removes it: the annual payment was the discounted one", async () => {
      await seedPromo(
        2,
        { providerPriceId: PRICES.proAnnual, billingInterval: "annual" },
        "annual",
      );

      await caller().createCheckoutOrUpdate({ plan: "pro", interval: "monthly" });

      expect(discountCall()).toBeUndefined();
      expect(updateCall()).toMatchObject({ discount: null });
    });

    test("once a change removed it, a later switch back to annual doesn't bring it back", async () => {
      // Monthly checkout, annual from month 2, back to monthly now (month 4).
      await seedPromo(4, { providerPriceId: PRICES.proAnnual, billingInterval: "annual" });

      await caller().createCheckoutOrUpdate({ plan: "pro", interval: "monthly" });
      expect(updateCall()).toMatchObject({ discount: null });
      const endedAt = (await stored())?.promoDiscountEndedAt;
      expect(endedAt).toBeInstanceOf(Date);

      calls = [];
      respond = () => paddleSub({ items: [{ price: { id: PRICES.proAnnual } }] });
      await caller().createCheckoutOrUpdate({ plan: "pro", interval: "annual" });

      expect(discountCall()).toBeUndefined();
      expect(updateCall()).toMatchObject({ discount: null });
    });

    test("a code other than ACTIVE_PROMO's, not in the registry, is removed on monthly to annual", async () => {
      expect(ACTIVE_PROMO.code).not.toBe("PARTNER10");
      await seedPromo(5, {}, "monthly", "PARTNER10");
      respond = () => paddleSub({ items: [{ price: { id: PRICES.proAnnual } }] });

      await caller().createCheckoutOrUpdate({ plan: "pro", interval: "annual" });

      expect(discountCall()).toBeUndefined();
      expect(updateCall()).toMatchObject({ discount: null });
    });

    test("a code not in the registry is left alone on a monthly plan switch", async () => {
      await seedPromo(3, {}, "monthly", "PARTNER10");
      respond = () => paddleSub({ items: [{ price: { id: PRICES.ultraMonthly } }] });

      await caller().createCheckoutOrUpdate({ plan: "ultra", interval: "monthly" });

      expect(discountCall()).toBeUndefined();
      expect(updateCall()).not.toHaveProperty("discount");
    });
  });

  test("a change sent from a screen still showing Free is refused before Paddle is called", async () => {
    await seed();

    const error = await caller()
      .createCheckoutOrUpdate({ plan: "ultra", interval: "monthly", displayedPlanMode: "free" })
      .catch((err: Error) => err);

    expect(error).toMatchObject({ code: "CONFLICT", message: STALE_BILLING_MESSAGE });
    expect(calls).toHaveLength(0);
    expect((await stored())?.plan).toBe("pro");
  });

  test("a change sent with the stored plan mode goes ahead", async () => {
    await seed();
    respond = () => paddleSub({ items: [{ price: { id: PRICES.ultraMonthly } }] });

    const result = await caller().createCheckoutOrUpdate({
      plan: "ultra",
      interval: "monthly",
      displayedPlanMode: "pro",
    });

    expect(result).toEqual({ status: "updated", message: "Plan updated successfully!" });
    expect(calls.map(([method]) => method)).toEqual(["updateSubscription"]);
  });

  test("a change sent from a screen showing a paid plan after it expired is refused", async () => {
    await seed({ status: "expired", endsAt: new Date(Date.now() - DAY) });

    await expect(
      caller().createCheckoutOrUpdate({ plan: "ultra", displayedPlanMode: "pro" }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: STALE_BILLING_MESSAGE });
    expect(calls).toHaveLength(0);
  });

  test("choosing the current price changes nothing", async () => {
    await seed();

    const result = await caller().createCheckoutOrUpdate({ plan: "pro", interval: "monthly" });

    expect(result).toEqual({ status: "updated", message: "You are already on this plan." });
    expect(calls).toHaveLength(0);
  });

  test("a past_due subscription must fix its payment method before changing plans", async () => {
    await seed({ status: "past_due" });

    await expect(caller().createCheckoutOrUpdate({ plan: "ultra" })).rejects.toThrow(
      "Update your payment method first.",
    );
    await expect(
      caller().downgradeWithFeedback({ targetPlan: "free", reason: "other" }),
    ).resolves.toMatchObject({ status: "cancelled" });
    expect(calls.map(([method]) => method)).not.toContain("updateSubscription");
  });

  test("a change Paddle refuses (renewal lock) is reported as not applicable", async () => {
    await seed();
    respond = () => paddleError(400);

    const error = await caller()
      .createCheckoutOrUpdate({ plan: "ultra" })
      .catch((err: Error) => err);

    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    expect(error.message).toBe(
      "We couldn't apply this change. Please try again or contact support.",
    );
    expect((await stored())?.plan).toBe("pro");
  });

  test("a discount Paddle won't apply gets the generic message, a declined card the payment one", async () => {
    await seed();
    const refused = (code: string) =>
      new PaddleApiError({
        method: "PATCH",
        path: `/subscriptions/${SUBSCRIPTION_ID}`,
        status: 400,
        code,
        detail: "refused",
        requestId: null,
      });

    respond = () => refused("subscription_one_off_discount_not_valid");
    await expect(caller().createCheckoutOrUpdate({ plan: "ultra" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "We couldn't apply this change. Please try again or contact support.",
    });

    respond = () => refused("subscription_payment_declined");
    await expect(caller().createCheckoutOrUpdate({ plan: "ultra" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Check your payment method"),
    });
  });

  test("a downgrade to Pro switches now and credits the unused time right away", async () => {
    await seed({ plan: "ultra", providerPriceId: PRICES.ultraAnnual, billingInterval: "annual" });
    respond = () => paddleSub({ items: [{ price: { id: PRICES.proAnnual } }] });

    const result = await caller().downgradeWithFeedback({
      targetPlan: "pro",
      reason: "too_expensive",
    });

    expect(result).toEqual({
      status: "downgraded",
      message: "You're now on Pro. Credit for unused Ultra time goes toward your next invoice.",
    });
    expect(calls).toEqual([
      [
        "updateSubscription",
        SUBSCRIPTION_ID,
        {
          items: [{ priceId: PRICES.proAnnual, quantity: 1 }],
          // Credited to the Paddle balance now, so a switch to annual in the same period uses it
          // instead of waiting for the next renewal a year later.
          prorationBillingMode: "prorated_immediately",
        },
      ],
    ]);
    expect(await stored()).toMatchObject({
      plan: "pro",
      billingInterval: "annual",
      providerPriceId: PRICES.proAnnual,
    });
    const records = await cancellations();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      subscriptionId: 0,
      providerSubscriptionId: SUBSCRIPTION_ID,
      fromPlan: "ultra",
      toPlan: "pro",
      billingInterval: "annual",
      outcome: "downgraded",
    });
  });

  test("a downgrade to Free cancels at the end of the billing period", async () => {
    await seed();
    respond = () =>
      paddleSub({
        scheduled_change: { action: "cancel", effective_at: PERIOD_END, resume_at: null },
      });

    const result = await caller().downgradeWithFeedback({
      targetPlan: "free",
      reason: "not_using_features",
    });

    expect(result).toEqual({
      status: "cancelled",
      message: "Your subscription has been cancelled. You'll keep access until January 15, 2027.",
    });
    expect(calls).toEqual([["cancelSubscription", SUBSCRIPTION_ID, "next_billing_period"]]);
    const row = await stored();
    expect(row).toMatchObject({ status: "cancelled", plan: "pro", renewsAt: null });
    expect(row?.endsAt?.toISOString()).toBe(PERIOD_END);
    const records = await cancellations();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      subscriptionId: 0,
      providerSubscriptionId: SUBSCRIPTION_ID,
      toPlan: "free",
      offerShown: "pause",
      outcome: "cancelled",
    });
  });

  test("cancelSubscription cancels at the end of the billing period", async () => {
    await seed();
    respond = () =>
      paddleSub({
        scheduled_change: { action: "cancel", effective_at: PERIOD_END, resume_at: null },
      });

    await caller().cancelSubscription();

    expect(calls).toEqual([["cancelSubscription", SUBSCRIPTION_ID, "next_billing_period"]]);
    expect(await stored()).toMatchObject({ status: "cancelled", endsAt: new Date(PERIOD_END) });
  });

  test("resuming a cancelled subscription removes the scheduled cancel", async () => {
    await seed({ status: "cancelled", endsAt: new Date(PERIOD_END), renewsAt: null });

    const result = await caller().resumeSubscription();

    expect(result).toEqual({ message: "Your subscription has been resumed." });
    expect(calls).toEqual([["updateSubscription", SUBSCRIPTION_ID, { scheduledChange: null }]]);
    expect(await stored()).toMatchObject({
      status: "active",
      endsAt: null,
      renewsAt: new Date(PERIOD_END),
    });
  });

  test("resuming a paused subscription resumes it immediately", async () => {
    await seed({ status: "paused", pausedUntil: new Date(Date.now() + 30 * DAY) });

    await caller().resumeSubscription();

    expect(calls).toEqual([["resumeSubscription", SUBSCRIPTION_ID, "immediately"]]);
    expect(await stored()).toMatchObject({ status: "active", pausedUntil: null });
  });

  test("resuming before a scheduled pause starts removes the scheduled pause", async () => {
    await seed({ pausedUntil: addMonths(new Date(PERIOD_END), 1) });

    await caller().resumeSubscription();

    expect(calls).toEqual([["updateSubscription", SUBSCRIPTION_ID, { scheduledChange: null }]]);
    expect(await stored()).toMatchObject({ status: "active", pausedUntil: null });
  });

  test("a pause starts at the end of the period and restarts months after it", async () => {
    await seed();
    const resumeAt = addMonths(new Date(PERIOD_END), 2).toISOString();
    respond = (method) =>
      method === "pauseSubscription"
        ? paddleSub({
            scheduled_change: { action: "pause", effective_at: PERIOD_END, resume_at: resumeAt },
          })
        : paddleSub();

    const result = await caller().pauseSubscription({ months: 2, reason: "temporary_pause" });

    expect(result).toEqual({
      message: "Your subscription pauses on January 15, 2027 and resumes on March 15, 2027.",
    });
    expect(calls).toEqual([
      ["getSubscription", SUBSCRIPTION_ID],
      ["pauseSubscription", SUBSCRIPTION_ID, { effectiveFrom: "next_billing_period", resumeAt }],
    ]);
    const row = await stored();
    expect(row).toMatchObject({
      status: "active",
      renewsAt: new Date(PERIOD_END),
      pausedUntil: new Date(resumeAt),
    });
    const records = await cancellations();
    expect(records[0]).toMatchObject({
      subscriptionId: 0,
      providerSubscriptionId: SUBSCRIPTION_ID,
      outcome: "paused",
      pauseMonths: 2,
    });
  });

  test("subscriptionDetails opens a portal session for the subscription", async () => {
    await seed();

    const urls = await caller().subscriptionDetails();

    expect(urls).toEqual({
      customer_portal: PORTAL.overview,
      update_payment_method: PORTAL.paymentMethod,
    });
    expect(calls).toEqual([["createPortalSession", CUSTOMER_ID, [SUBSCRIPTION_ID]]]);
  });

  test("updatePaymentMethodUrl uses the portal, then the update transaction, then null", async () => {
    await seed();
    expect(await caller().updatePaymentMethodUrl()).toBe(PORTAL.paymentMethod);

    portalFails = true;
    expect(await caller().updatePaymentMethodUrl()).toBe("https://pay.paddle.test/txn_01update");
    expect(calls.at(-1)).toEqual(["getUpdatePaymentMethodTransaction", SUBSCRIPTION_ID]);

    expect(await caller(null).updatePaymentMethodUrl()).toBeNull();
  });

  test("a Paddle row fails cleanly while Paddle isn't configured", async () => {
    await seed();

    await expect(caller(null).cancelSubscription()).rejects.toThrow(
      "Our payment provider is unavailable right now.",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("a Paddle row is managed without the Lemon Squeezy env", async () => {
    await seed();
    const lemonSqueezyEnv = {
      LEMONSQUEEZY_API_KEY: env.LEMONSQUEEZY_API_KEY,
      LEMONSQUEEZY_STORE_ID: env.LEMONSQUEEZY_STORE_ID,
      LEMONSQUEEZY_WEBHOOK_SECRET: env.LEMONSQUEEZY_WEBHOOK_SECRET,
    };
    Object.assign(env, {
      LEMONSQUEEZY_API_KEY: undefined,
      LEMONSQUEEZY_STORE_ID: undefined,
      LEMONSQUEEZY_WEBHOOK_SECRET: undefined,
    });
    try {
      expect(await caller().subscriptionDetails()).toMatchObject({
        customer_portal: PORTAL.overview,
      });
      respond = () =>
        paddleSub({
          scheduled_change: { action: "cancel", effective_at: PERIOD_END, resume_at: null },
        });
      await caller().cancelSubscription();
      expect(await stored()).toMatchObject({ status: "cancelled" });
    } finally {
      Object.assign(env, lemonSqueezyEnv);
    }
  });

  test("a failed portal session is reported as a provider error", async () => {
    await seed();
    portalFails = true;

    await expect(caller().subscriptionDetails()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Our payment provider is unavailable right now. Please try again in a few minutes.",
    });
  });

  test("a Lemon Squeezy row still goes to Lemon Squeezy", async () => {
    await seed({
      billingProvider: "lemonsqueezy",
      subscriptionId: 935001,
      customerId: 1,
      variantId: 1811616,
      providerSubscriptionId: null,
      providerCustomerId: null,
      providerPriceId: null,
    });
    const requests: { method: string; url: string }[] = [];
    fetchSpy.mockImplementation(async (input, init) => {
      requests.push({ method: init?.method ?? "GET", url: String(input) });
      return Response.json({
        data: {
          id: "935001",
          attributes: {
            status: "cancelled",
            variant_id: 1811616,
            product_id: 0,
            renews_at: null,
            ends_at: PERIOD_END,
            updated_at: new Date(Date.now()).toISOString(),
          },
        },
      });
    });

    await caller().cancelSubscription();

    expect(requests).toEqual([
      { method: "DELETE", url: "https://api.lemonsqueezy.com/v1/subscriptions/935001" },
    ]);
    expect(calls).toHaveLength(0);
    expect(await stored()).toMatchObject({ status: "cancelled", endsAt: new Date(PERIOD_END) });
  });
});
