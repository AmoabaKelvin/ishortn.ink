import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";

import { env } from "@/env.mjs";
import { checkoutDiscountCode } from "@/lib/billing/promo";
import { PaddleApiError } from "@/lib/paddle/client";
import { buildPaddleConfig } from "@/lib/paddle/config";

import { stubCloudflareContext } from "../../../../../test/cloudflare-context";
import { startNewCheckout } from "./lemonsqueezy.procedure";
import { createPaddleCheckout } from "./paddle-checkout";

import type { NewCheckoutDeps, NewCheckoutInput } from "./lemonsqueezy.procedure";
import type { PaddleCheckoutClient, PaddleCheckoutInput } from "./paddle-checkout";
import type {
  CreateTransactionInput,
  PaddleDiscount,
  PaddleTransaction,
} from "@/lib/paddle/client";
import type { PaddleEnv } from "@/lib/paddle/config";
import type { Subscription } from "@/server/db/schema";
import type { CheckoutStartInput } from "@/server/lib/checkout-starts";

const PADDLE_ENV: PaddleEnv = {
  BILLING_PROVIDER: "lemonsqueezy",
  PADDLE_ENVIRONMENT: "sandbox",
  PADDLE_API_KEY: "pdl_sdbx_apikey_123",
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_secret",
  PADDLE_CLIENT_TOKEN: "test_clienttoken",
  PADDLE_PRICE_PRO_MONTHLY: "pri_pro_m",
  PADDLE_PRICE_PRO_ANNUAL: "pri_pro_y",
  PADDLE_PRICE_ULTRA_MONTHLY: "pri_ultra_m",
  PADDLE_PRICE_ULTRA_ANNUAL: "pri_ultra_y",
  PADDLE_PRICE_PRO_LEGACY_MONTHLY: undefined,
  PADDLE_CHECKOUT_USER_IDS: "user_paddle",
};

const rejectedDiscount = new PaddleApiError({
  method: "POST",
  path: "/transactions",
  status: 400,
  code: "transaction_discount_not_eligible",
  detail: "Discount is not eligible",
  requestId: null,
});

type StubCalls = {
  findCustomerByEmail: string[];
  createCustomer: string[];
  findActiveDiscountByCode: string[];
  createTransaction: CreateTransactionInput[];
  listOpenTransactions: string[];
  cancelTransaction: string[];
};

function stubPaddle(options: {
  existingCustomerId?: string;
  /** Answers every code lookup with a discount of this id, set up as the docs describe. */
  discountId?: string;
  /** Answers every code lookup with exactly this discount. */
  discount?: PaddleDiscount;
  transactions?: (PaddleTransaction | Error)[];
  openTransactions?: PaddleTransaction[] | Error;
}) {
  const calls: StubCalls = {
    findCustomerByEmail: [],
    createCustomer: [],
    findActiveDiscountByCode: [],
    createTransaction: [],
    listOpenTransactions: [],
    cancelTransaction: [],
  };
  const transactions = options.transactions ?? [
    {
      id: "txn_1",
      status: "ready",
      checkout: { url: "https://ishortn.test/checkout?_ptxn=txn_1" },
    },
  ];
  const client: PaddleCheckoutClient = {
    findCustomerByEmail: async (email: string) => {
      calls.findCustomerByEmail.push(email);
      return options.existingCustomerId
        ? { id: options.existingCustomerId, email, name: null }
        : undefined;
    },
    createCustomer: async ({ email }: { email: string }) => {
      calls.createCustomer.push(email);
      return { id: "ctm_new", email, name: null };
    },
    findActiveDiscountByCode: async (code: string) => {
      calls.findActiveDiscountByCode.push(code);
      if (options.discount) return options.discount;
      if (!options.discountId) return undefined;
      return code.endsWith("ANNUAL")
        ? { id: options.discountId, recur: false, maximum_recurring_intervals: null }
        : { id: options.discountId, recur: true, maximum_recurring_intervals: 12 };
    },
    createTransaction: async (input: CreateTransactionInput) => {
      calls.createTransaction.push(input);
      const next = transactions[calls.createTransaction.length - 1]!;
      if (next instanceof Error) throw next;
      return next;
    },
    listOpenTransactions: async (customerId: string) => {
      calls.listOpenTransactions.push(customerId);
      if (options.openTransactions instanceof Error) throw options.openTransactions;
      return options.openTransactions ?? [];
    },
    cancelTransaction: async (id: string) => {
      calls.cancelTransaction.push(id);
      return { id, status: "canceled", checkout: null };
    },
  };
  return { calls, client };
}

const baseInput: PaddleCheckoutInput = {
  userId: "user_paddle",
  email: "ada@example.com",
  subscription: null,
  plan: "pro",
  interval: "annual",
  priceId: "pri_pro_y",
  attribution: { source: "pricing", utm_campaign: "bfcm2026" },
  promoCode: "BFCM20",
};

describe("createPaddleCheckout", () => {
  test("creates a transaction with the price, customer, custom data and discount", async () => {
    const { calls, client } = stubPaddle({ existingCustomerId: "ctm_found", discountId: "dsc_1" });

    const result = await createPaddleCheckout(client, baseInput);

    expect(result).toEqual({
      url: "https://ishortn.test/checkout?_ptxn=txn_1",
      discountCode: "BFCM20",
    });
    expect(calls.findCustomerByEmail).toEqual(["ada@example.com"]);
    expect(calls.createCustomer).toEqual([]);
    expect(calls.findActiveDiscountByCode).toEqual(["BFCM20ANNUAL"]);
    expect(calls.createTransaction).toEqual([
      {
        items: [{ priceId: "pri_pro_y", quantity: 1 }],
        customerId: "ctm_found",
        collectionMode: "automatic",
        customData: {
          user_id: "user_paddle",
          source: "pricing",
          utm_campaign: "bfcm2026",
          discount_code: "BFCM20",
          plan: "pro",
          interval: "annual",
        },
        discountId: "dsc_1",
      },
    ]);
  });

  test("monthly checkout applies the promo's 12-recurrence monthly discount", async () => {
    const { calls, client } = stubPaddle({ existingCustomerId: "ctm_found", discountId: "dsc_m" });

    const result = await createPaddleCheckout(client, {
      ...baseInput,
      interval: "monthly",
      priceId: "pri_pro_m",
    });

    expect(result.discountCode).toBe("BFCM20");
    expect(calls.findActiveDiscountByCode).toEqual(["BFCM20"]);
    expect(calls.createTransaction[0]?.discountId).toBe("dsc_m");
  });

  test("annual checkout applies the promo's one-off annual discount", async () => {
    const { calls, client } = stubPaddle({ existingCustomerId: "ctm_found", discountId: "dsc_y" });

    const result = await createPaddleCheckout(client, baseInput);

    expect(result.discountCode).toBe("BFCM20");
    expect(calls.findActiveDiscountByCode).toEqual(["BFCM20ANNUAL"]);
    expect(calls.createTransaction[0]?.discountId).toBe("dsc_y");
  });

  test("a discount whose recurrence doesn't fit the interval is not sent", async () => {
    // One 12-recurrence discount on an annual price would discount 12 annual payments.
    const recurring = { id: "dsc_12", recur: true, maximum_recurring_intervals: 12 };
    const annual = stubPaddle({ existingCustomerId: "ctm_found", discount: recurring });
    expect((await createPaddleCheckout(annual.client, baseInput)).discountCode).toBeUndefined();
    expect(annual.calls.createTransaction[0]?.discountId).toBeUndefined();

    const forever = { id: "dsc_forever", recur: true, maximum_recurring_intervals: null };
    const monthly = stubPaddle({ existingCustomerId: "ctm_found", discount: forever });
    const result = await createPaddleCheckout(monthly.client, {
      ...baseInput,
      interval: "monthly",
      priceId: "pri_pro_m",
    });
    expect(result.discountCode).toBeUndefined();
    expect(monthly.calls.createTransaction[0]?.discountId).toBeUndefined();
  });

  test("reuses the Paddle customer on the subscription row", async () => {
    const { calls, client } = stubPaddle({});
    // SAFETY: the checkout reads only billingProvider and providerCustomerId from the row.
    const subscription = {
      billingProvider: "paddle",
      providerCustomerId: "ctm_row",
    } as Subscription;

    await createPaddleCheckout(client, { ...baseInput, subscription });

    expect(calls.findCustomerByEmail).toEqual([]);
    expect(calls.createTransaction[0]?.customerId).toBe("ctm_row");
  });

  test("creates the customer when none exists for the email", async () => {
    const { calls, client } = stubPaddle({});
    // SAFETY: a Lemon Squeezy row's customer id is not a Paddle customer.
    const subscription = {
      billingProvider: "lemonsqueezy",
      providerCustomerId: null,
    } as Subscription;

    await createPaddleCheckout(client, { ...baseInput, subscription });

    expect(calls.findCustomerByEmail).toEqual(["ada@example.com"]);
    expect(calls.createCustomer).toEqual(["ada@example.com"]);
    expect(calls.createTransaction[0]?.customerId).toBe("ctm_new");
  });

  test("a code with no active Paddle discount is not sent", async () => {
    const { calls, client } = stubPaddle({ existingCustomerId: "ctm_found" });

    const result = await createPaddleCheckout(client, baseInput);

    expect(result.discountCode).toBeUndefined();
    expect(calls.createTransaction).toHaveLength(1);
    expect(calls.createTransaction[0]?.discountId).toBeUndefined();
    expect(calls.createTransaction[0]?.customData?.discount_code).toBeUndefined();
  });

  test("a rejected discount retries once without it", async () => {
    const { calls, client } = stubPaddle({
      existingCustomerId: "ctm_found",
      discountId: "dsc_1",
      transactions: [
        rejectedDiscount,
        { id: "txn_2", status: "ready", checkout: { url: "https://ishortn.test/c/2" } },
      ],
    });

    const result = await createPaddleCheckout(client, baseInput);

    expect(result).toEqual({ url: "https://ishortn.test/c/2", discountCode: undefined });
    expect(calls.createTransaction.map((call) => call.discountId)).toEqual(["dsc_1", undefined]);
    expect(calls.createTransaction[1]?.customData?.discount_code).toBeUndefined();
  });

  test("other Paddle failures map to the provider error without a retry", async () => {
    const { calls, client } = stubPaddle({
      existingCustomerId: "ctm_found",
      discountId: "dsc_1",
      transactions: [
        new PaddleApiError({
          method: "POST",
          path: "/transactions",
          status: 500,
          code: "internal_error",
          detail: "boom",
          requestId: null,
        }),
      ],
    });

    await expect(createPaddleCheckout(client, baseInput)).rejects.toThrow(
      "Our payment provider is unavailable right now.",
    );
    expect(calls.createTransaction).toHaveLength(1);
  });

  test("cancels the customer's earlier unpaid checkouts before creating a new one", async () => {
    const { calls, client } = stubPaddle({
      existingCustomerId: "ctm_found",
      openTransactions: [
        { id: "txn_old_ready", status: "ready", subscription_id: null, checkout: null },
        { id: "txn_old_draft", status: "draft", checkout: null },
        // A payment-method update for an existing subscription stays open.
        { id: "txn_pm_update", status: "ready", subscription_id: "sub_1", checkout: null },
      ],
    });

    const result = await createPaddleCheckout(client, baseInput);

    expect(result.url).toBe("https://ishortn.test/checkout?_ptxn=txn_1");
    expect(calls.listOpenTransactions).toEqual(["ctm_found"]);
    expect(calls.cancelTransaction).toEqual(["txn_old_ready", "txn_old_draft"]);
    expect(calls.createTransaction).toHaveLength(1);
  });

  test("a failure cancelling earlier checkouts doesn't block the new one", async () => {
    const { calls, client } = stubPaddle({
      existingCustomerId: "ctm_found",
      openTransactions: new Error("network"),
    });

    const result = await createPaddleCheckout(client, baseInput);

    expect(result.url).toBe("https://ishortn.test/checkout?_ptxn=txn_1");
    expect(calls.createTransaction).toHaveLength(1);
  });

  test("without a customer there are no earlier checkouts to cancel", async () => {
    const { calls, client } = stubPaddle({});

    await createPaddleCheckout(client, { ...baseInput, email: null });

    expect(calls.listOpenTransactions).toEqual([]);
    expect(calls.createTransaction[0]?.customerId).toBeUndefined();
  });

  test("a transaction without a checkout url fails with the provider error", async () => {
    const { client } = stubPaddle({
      transactions: [{ id: "txn_3", status: "ready", checkout: { url: null } }],
    });

    await expect(createPaddleCheckout(client, baseInput)).rejects.toThrow(
      "Our payment provider is unavailable right now.",
    );
  });
});

describe("startNewCheckout", () => {
  let restoreContext: () => void;
  let starts: CheckoutStartInput[];
  let lemonSqueezyCalls: number;
  let lemonSqueezyConfigured: number;

  const recordStart = async (start: CheckoutStartInput) => void starts.push(start);
  // Stands in for configureLemonSqueezy with no Lemon Squeezy env set, where it throws.
  const configureLemonSqueezy = () => {
    lemonSqueezyConfigured += 1;
  };

  const createLemonSqueezyCheckout: NewCheckoutDeps["createLemonSqueezyCheckout"] = async () => {
    lemonSqueezyCalls += 1;
    // SAFETY: the checkout reads only error, statusCode and data.data.attributes.url.
    return {
      error: null,
      statusCode: 201,
      data: { data: { attributes: { url: "https://pay.test/c/1" } } },
    } as Awaited<ReturnType<NewCheckoutDeps["createLemonSqueezyCheckout"]>>;
  };

  const input = (userId: string): NewCheckoutInput => ({
    userId,
    user: { email: "ada@example.com" },
    subscription: null,
    plan: "pro",
    interval: "monthly",
    source: "pricing",
  });

  beforeAll(() => {
    restoreContext = stubCloudflareContext();
  });
  beforeEach(() => {
    starts = [];
    lemonSqueezyCalls = 0;
    lemonSqueezyConfigured = 0;
  });
  afterAll(() => restoreContext());

  test("without Paddle configured the Lemon Squeezy checkout runs", async () => {
    const { calls, client } = stubPaddle({});

    const result = await startNewCheckout(
      {
        recordStart,
        paddleConfig: null,
        paddleClient: client,
        createLemonSqueezyCheckout,
        configureLemonSqueezy,
      },
      input("user_paddle"),
    );

    expect(result).toEqual({ status: "redirect", url: "https://pay.test/c/1" });
    expect(lemonSqueezyCalls).toBe(1);
    expect(lemonSqueezyConfigured).toBe(1);
    expect(calls.createTransaction).toHaveLength(0);
    expect(starts).toEqual([expect.objectContaining({ provider: "lemonsqueezy" })]);
  });

  test("a user outside the allowlist stays on Lemon Squeezy", async () => {
    const { calls, client } = stubPaddle({});

    await startNewCheckout(
      {
        recordStart,
        paddleConfig: buildPaddleConfig(PADDLE_ENV),
        paddleClient: client,
        createLemonSqueezyCheckout,
        configureLemonSqueezy,
      },
      input("user_other"),
    );

    expect(lemonSqueezyCalls).toBe(1);
    expect(calls.createTransaction).toHaveLength(0);
  });

  test("an allowlisted user checks out through Paddle and the start records it", async () => {
    const { calls, client } = stubPaddle({ existingCustomerId: "ctm_found", discountId: "dsc_1" });

    const result = await startNewCheckout(
      {
        recordStart,
        paddleConfig: buildPaddleConfig(PADDLE_ENV),
        paddleClient: client,
        createLemonSqueezyCheckout,
        configureLemonSqueezy,
      },
      input("user_paddle"),
    );

    expect(result).toEqual({
      status: "redirect",
      url: "https://ishortn.test/checkout?_ptxn=txn_1",
    });
    expect(lemonSqueezyCalls).toBe(0);
    expect(calls.createTransaction).toHaveLength(1);
    expect(calls.createTransaction[0]?.items).toEqual([{ priceId: "pri_pro_m", quantity: 1 }]);
    const promoCode = checkoutDiscountCode();
    expect(starts).toEqual([
      {
        userId: "user_paddle",
        plan: "pro",
        interval: "monthly",
        source: "pricing",
        promoCode: promoCode ?? null,
        provider: "paddle",
      },
    ]);
  });

  const paddleDeps = (client: PaddleCheckoutClient): NewCheckoutDeps => ({
    recordStart,
    paddleConfig: buildPaddleConfig(PADDLE_ENV),
    paddleClient: client,
    createLemonSqueezyCheckout,
    configureLemonSqueezy,
  });

  // SAFETY: getSubscriptionMode reads only these fields of the row.
  const paddleRow = (fields: Partial<Subscription>) =>
    ({
      billingProvider: "paddle",
      subscriptionId: null,
      providerSubscriptionId: "sub_live",
      providerCustomerId: "ctm_row",
      variantId: null,
      productId: null,
      plan: "pro",
      endsAt: null,
      pausedUntil: null,
      ...fields,
    }) as Subscription;

  test.each([
    ["active", paddleRow({ status: "active" })],
    ["past due", paddleRow({ status: "past_due" })],
    ["paused", paddleRow({ status: "paused" })],
    [
      "cancelled in its paid period",
      paddleRow({ status: "cancelled", endsAt: new Date(Date.now() + 86_400_000) }),
    ],
  ])("a user with a %s Paddle subscription never gets a second checkout", async (_, row) => {
    const { calls, client } = stubPaddle({});

    const result = startNewCheckout(paddleDeps(client), {
      ...input("user_paddle"),
      plan: "ultra",
      subscription: row,
    });

    await expect(result).rejects.toMatchObject({ code: "CONFLICT" });
    expect(calls.createTransaction).toHaveLength(0);
    expect(lemonSqueezyCalls).toBe(0);
    expect(starts).toEqual([]);
  });

  test("a Paddle checkout opens without the Lemon Squeezy env", async () => {
    const { client } = stubPaddle({});

    const result = await startNewCheckout(
      {
        ...paddleDeps(client),
        configureLemonSqueezy: () => {
          throw new Error("Missing required LEMONSQUEEZY env variables");
        },
      },
      input("user_paddle"),
    );

    expect(result).toEqual({
      status: "redirect",
      url: "https://ishortn.test/checkout?_ptxn=txn_1",
    });
    expect(lemonSqueezyCalls).toBe(0);
  });

  describe("checkout_started", () => {
    const posthog = {
      NEXT_PUBLIC_POSTHOG_KEY: env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: env.NEXT_PUBLIC_POSTHOG_HOST,
    };
    let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

    // A fake PostHog with fetch intercepted, so nothing leaves the process.
    beforeEach(() => {
      Object.assign(env, {
        NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
        NEXT_PUBLIC_POSTHOG_HOST: "https://posthog.invalid",
      });
      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    });
    afterEach(() => {
      fetchSpy.mockRestore();
      Object.assign(env, posthog);
    });

    const captured = () =>
      fetchSpy.mock.calls
        .filter(([url]) => String(url).startsWith("https://posthog.invalid"))
        .map(([, init]) => JSON.parse(String(init?.body)));

    test("a sandbox Paddle checkout sends nothing to PostHog", async () => {
      const { client } = stubPaddle({});

      await startNewCheckout(paddleDeps(client), input("user_paddle"));

      expect(starts).toHaveLength(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test("a production Paddle checkout is sent with its billing environment", async () => {
      const { client } = stubPaddle({});
      const production = buildPaddleConfig({
        ...PADDLE_ENV,
        PADDLE_ENVIRONMENT: "production",
        PADDLE_API_KEY: "pdl_live_apikey_123",
        PADDLE_CLIENT_TOKEN: "live_clienttoken",
      });

      await startNewCheckout(
        { ...paddleDeps(client), paddleConfig: production },
        input("user_paddle"),
      );

      expect(captured()).toEqual([
        expect.objectContaining({
          event: "checkout_started",
          distinct_id: "user_paddle",
          properties: expect.objectContaining({ provider: "paddle", billing_env: "production" }),
        }),
      ]);
    });

    test("a Lemon Squeezy checkout is sent without a billing environment", async () => {
      const { client } = stubPaddle({});

      await startNewCheckout(paddleDeps(client), input("user_other"));

      const events = captured();
      expect(events).toEqual([
        expect.objectContaining({
          event: "checkout_started",
          properties: expect.objectContaining({ provider: "lemonsqueezy" }),
        }),
      ]);
      expect(events[0].properties).not.toHaveProperty("billing_env");
    });
  });

  test("a Paddle subscription that has ended can check out again", async () => {
    const { calls, client } = stubPaddle({});

    await startNewCheckout(paddleDeps(client), {
      ...input("user_paddle"),
      subscription: paddleRow({ status: "expired" }),
    });

    expect(calls.createTransaction).toHaveLength(1);
    expect(calls.createTransaction[0]?.customerId).toBe("ctm_row");
  });
});
