import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { checkoutDiscountCode } from "@/lib/billing/promo";
import { PaddleApiError } from "@/lib/paddle/client";
import { buildPaddleConfig } from "@/lib/paddle/config";

import { stubCloudflareContext } from "../../../../../test/cloudflare-context";
import { startNewCheckout } from "./lemonsqueezy.procedure";
import { createPaddleCheckout } from "./paddle-checkout";

import type { NewCheckoutDeps, NewCheckoutInput } from "./lemonsqueezy.procedure";
import type { PaddleCheckoutClient, PaddleCheckoutInput } from "./paddle-checkout";
import type { CreateTransactionInput, PaddleTransaction } from "@/lib/paddle/client";
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
  findActiveDiscountIdByCode: string[];
  createTransaction: CreateTransactionInput[];
};

function stubPaddle(options: {
  existingCustomerId?: string;
  discountId?: string;
  transactions?: (PaddleTransaction | Error)[];
}) {
  const calls: StubCalls = {
    findCustomerByEmail: [],
    createCustomer: [],
    findActiveDiscountIdByCode: [],
    createTransaction: [],
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
    findActiveDiscountIdByCode: async (code: string) => {
      calls.findActiveDiscountIdByCode.push(code);
      return options.discountId;
    },
    createTransaction: async (input: CreateTransactionInput) => {
      calls.createTransaction.push(input);
      const next = transactions[calls.createTransaction.length - 1]!;
      if (next instanceof Error) throw next;
      return next;
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
    expect(calls.findActiveDiscountIdByCode).toEqual(["BFCM20"]);
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

  const recordStart = async (start: CheckoutStartInput) => void starts.push(start);

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
  });
  afterAll(() => restoreContext());

  test("without Paddle configured the Lemon Squeezy checkout runs", async () => {
    const { calls, client } = stubPaddle({});

    const result = await startNewCheckout(
      { recordStart, paddleConfig: null, paddleClient: client, createLemonSqueezyCheckout },
      input("user_paddle"),
    );

    expect(result).toEqual({ status: "redirect", url: "https://pay.test/c/1" });
    expect(lemonSqueezyCalls).toBe(1);
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
