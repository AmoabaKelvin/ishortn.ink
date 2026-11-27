import { afterEach, beforeEach, describe, expect, setSystemTime, spyOn, test } from "bun:test";

import { PaddleApiError, createPaddleClient } from "./client";
import { buildPaddleConfig } from "./config";

import type { PaddleCustomData } from "./client";
import type { PaddleConfig } from "./config";

const API_KEY = "pdl_sdbx_apikey_secret";

const config = buildPaddleConfig({
  BILLING_PROVIDER: "lemonsqueezy",
  PADDLE_ENVIRONMENT: "sandbox",
  PADDLE_API_KEY: API_KEY,
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_secret",
  PADDLE_CLIENT_TOKEN: "test_clienttoken",
  PADDLE_PRICE_PRO_MONTHLY: "pri_pro_m",
  PADDLE_PRICE_PRO_ANNUAL: "pri_pro_y",
  PADDLE_PRICE_ULTRA_MONTHLY: "pri_ultra_m",
  PADDLE_PRICE_ULTRA_ANNUAL: "pri_ultra_y",
  PADDLE_PRICE_PRO_LEGACY_MONTHLY: undefined,
  PADDLE_CHECKOUT_USER_IDS: undefined,
});
if (!config) throw new Error("test config must be valid");
const sandbox: PaddleConfig = config;

const BASE = "https://sandbox-api.paddle.com";

const ok = (data: PaddleCustomData | PaddleCustomData[]) =>
  new Response(JSON.stringify({ data, meta: { request_id: "req_ok" } }), { status: 200 });

const fail = (status: number, code: string, detail: string) =>
  new Response(
    JSON.stringify({
      error: {
        type: "request_error",
        code,
        detail,
        documentation_url: "https://developer.paddle.com",
      },
      meta: { request_id: "req_err" },
    }),
    { status },
  );

const subscription = {
  id: "sub_1",
  status: "active",
  customer_id: "ctm_1",
  address_id: "add_1",
  items: [{ status: "active", quantity: 1, price: { id: "pri_pro_m", product_id: "pro_1" } }],
  scheduled_change: null,
  current_billing_period: {
    starts_at: "2026-11-01T00:00:00Z",
    ends_at: "2026-12-01T00:00:00Z",
  },
  next_billed_at: "2026-12-01T00:00:00Z",
  started_at: "2026-11-01T00:00:00Z",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  custom_data: { userId: "user_1" },
};

const transaction = {
  id: "txn_1",
  status: "ready",
  customer_id: "ctm_1",
  checkout: { url: "https://ishortn.ink/pay?_ptxn=txn_1" },
};

const customer = { id: "ctm_1", email: "ada@example.com", name: "Ada", status: "active" };

describe("Paddle client", () => {
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    setSystemTime();
  });

  const call = (index = 0) => {
    const [url, init] = fetchSpy.mock.calls[index] ?? [];
    return {
      url: String(url),
      method: init?.method,
      // SAFETY: the client always passes headers as a plain object literal.
      headers: init?.headers as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
  };

  test("sends the bearer key and JSON headers to the configured base URL", async () => {
    fetchSpy.mockResolvedValueOnce(ok(customer));
    await createPaddleClient(sandbox).getCustomer("ctm_1");

    const { url, method, headers, body } = call();
    expect(url).toBe(`${BASE}/customers/ctm_1`);
    expect(method).toBe("GET");
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(body).toBeUndefined();
  });

  test("uses the production API for production config", async () => {
    fetchSpy.mockResolvedValueOnce(ok(customer));
    await createPaddleClient({ ...sandbox, environment: "production" }).getCustomer("ctm_1");
    expect(call().url).toBe("https://api.paddle.com/customers/ctm_1");
  });

  test("createTransaction maps the input to Paddle's body and parses the checkout URL", async () => {
    fetchSpy.mockResolvedValueOnce(ok(transaction));
    const result = await createPaddleClient(sandbox).createTransaction({
      items: [{ priceId: "pri_pro_m", quantity: 1 }],
      customerId: "ctm_1",
      customData: { userId: "user_1" },
      discountId: "dsc_1",
      collectionMode: "automatic",
    });

    expect(result).toEqual({
      id: "txn_1",
      status: "ready",
      checkout: { url: "https://ishortn.ink/pay?_ptxn=txn_1" },
    });
    const { url, method, body } = call();
    expect(url).toBe(`${BASE}/transactions`);
    expect(method).toBe("POST");
    expect(body).toEqual({
      items: [{ price_id: "pri_pro_m", quantity: 1 }],
      customer_id: "ctm_1",
      custom_data: { userId: "user_1" },
      discount_id: "dsc_1",
      collection_mode: "automatic",
    });
  });

  test("createTransaction omits optional fields that weren't given", async () => {
    fetchSpy.mockResolvedValueOnce(ok(transaction));
    await createPaddleClient(sandbox).createTransaction({
      items: [{ priceId: "pri_pro_m", quantity: 1 }],
      collectionMode: "automatic",
    });
    expect(call().body).toEqual({
      items: [{ price_id: "pri_pro_m", quantity: 1 }],
      collection_mode: "automatic",
    });
  });

  test("a rejected discount surfaces as PaddleApiError with Paddle's code", async () => {
    fetchSpy.mockResolvedValueOnce(
      fail(400, "transaction_discount_not_eligible", "discount is not eligible"),
    );
    const attempt = createPaddleClient(sandbox).createTransaction({
      items: [{ priceId: "pri_pro_m", quantity: 1 }],
      discountId: "dsc_expired",
      collectionMode: "automatic",
    });

    await expect(attempt).rejects.toBeInstanceOf(PaddleApiError);
    await expect(attempt).rejects.toMatchObject({
      status: 400,
      code: "transaction_discount_not_eligible",
      detail: "discount is not eligible",
      requestId: "req_err",
      message: expect.not.stringContaining(API_KEY),
    });
  });

  test("a 5xx without a JSON body is still a PaddleApiError", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("<html>Bad gateway</html>", {
        status: 502,
        statusText: "Bad Gateway",
        headers: { "x-request-id": "req_hdr" },
      }),
    );
    const attempt = createPaddleClient(sandbox).getSubscription("sub_1");

    await expect(attempt).rejects.toBeInstanceOf(PaddleApiError);
    await expect(attempt).rejects.toMatchObject({
      status: 502,
      code: "unknown",
      detail: "Bad Gateway",
      requestId: "req_hdr",
      message: expect.not.stringContaining(API_KEY),
    });
  });

  test("a success response missing required fields is an invalid_response error", async () => {
    fetchSpy.mockResolvedValueOnce(ok({ id: "sub_1" }));
    const attempt = createPaddleClient(sandbox).getSubscription("sub_1");
    await expect(attempt).rejects.toBeInstanceOf(PaddleApiError);
    await expect(attempt).rejects.toMatchObject({ code: "invalid_response" });
  });

  test("findActiveDiscountIdByCode queries active discounts and caches for 10 minutes", async () => {
    const client = createPaddleClient(sandbox);
    setSystemTime(new Date("2026-11-27T00:00:00Z"));
    fetchSpy.mockResolvedValueOnce(ok([{ id: "dsc_1", code: "BFCM20", status: "active" }]));

    expect(await client.findActiveDiscountIdByCode("BFCM20")).toBe("dsc_1");
    expect(call().url).toBe(`${BASE}/discounts?code=BFCM20&status=active`);
    expect(call().method).toBe("GET");

    setSystemTime(new Date("2026-11-27T00:09:59Z"));
    expect(await client.findActiveDiscountIdByCode("BFCM20")).toBe("dsc_1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    setSystemTime(new Date("2026-11-27T00:10:01Z"));
    fetchSpy.mockResolvedValueOnce(ok([]));
    expect(await client.findActiveDiscountIdByCode("BFCM20")).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test("findCustomerByEmail encodes the email and returns the first match", async () => {
    fetchSpy.mockResolvedValueOnce(ok([customer]));
    const client = createPaddleClient(sandbox);
    expect(await client.findCustomerByEmail("ada+x@example.com")).toEqual({
      id: "ctm_1",
      email: "ada@example.com",
      name: "Ada",
    });
    expect(call().url).toBe(`${BASE}/customers?email=ada%2Bx%40example.com`);

    fetchSpy.mockResolvedValueOnce(ok([]));
    expect(await client.findCustomerByEmail("none@example.com")).toBeUndefined();
  });

  test("createCustomer posts the email and name", async () => {
    fetchSpy.mockResolvedValueOnce(ok(customer));
    expect(
      (await createPaddleClient(sandbox).createCustomer({ email: "ada@example.com", name: "Ada" }))
        .id,
    ).toBe("ctm_1");
    expect(call()).toMatchObject({
      url: `${BASE}/customers`,
      method: "POST",
      body: { email: "ada@example.com", name: "Ada" },
    });
  });

  test("createCustomer returns the existing customer on customer_already_exists", async () => {
    fetchSpy
      .mockResolvedValueOnce(fail(409, "customer_already_exists", "customer email conflicts"))
      .mockResolvedValueOnce(ok([customer]));

    const result = await createPaddleClient(sandbox).createCustomer({ email: "ada@example.com" });
    expect(result.id).toBe("ctm_1");
    expect(call(1).url).toBe(`${BASE}/customers?email=ada%40example.com`);
  });

  test("createCustomer rethrows other errors", async () => {
    fetchSpy.mockResolvedValueOnce(fail(400, "bad_request", "invalid email"));
    const attempt = createPaddleClient(sandbox).createCustomer({ email: "nope" });
    await expect(attempt).rejects.toMatchObject({ code: "bad_request" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("getSubscription parses the fields the app uses", async () => {
    fetchSpy.mockResolvedValueOnce(
      ok({
        ...subscription,
        scheduled_change: {
          action: "pause",
          effective_at: "2026-12-01T00:00:00Z",
          resume_at: "2027-01-01T00:00:00Z",
        },
      }),
    );
    const result = await createPaddleClient(sandbox).getSubscription("sub_1");
    expect(call().url).toBe(`${BASE}/subscriptions/sub_1`);
    expect(result.items).toEqual([{ price: { id: "pri_pro_m" } }]);
    expect(result.scheduled_change).toEqual({
      action: "pause",
      effective_at: "2026-12-01T00:00:00Z",
      resume_at: "2027-01-01T00:00:00Z",
    });
    expect(result.current_billing_period?.ends_at).toBe("2026-12-01T00:00:00Z");
    expect(result.custom_data).toEqual({ userId: "user_1" });
    expect("address_id" in result).toBe(false);
  });

  test("updateSubscription PATCHes items, proration mode and a null scheduled change", async () => {
    fetchSpy.mockResolvedValueOnce(ok(subscription));
    await createPaddleClient(sandbox).updateSubscription("sub_1", {
      items: [{ priceId: "pri_ultra_m", quantity: 1 }],
      prorationBillingMode: "prorated_immediately",
      scheduledChange: null,
    });
    expect(call()).toMatchObject({
      url: `${BASE}/subscriptions/sub_1`,
      method: "PATCH",
      body: {
        items: [{ price_id: "pri_ultra_m", quantity: 1 }],
        proration_billing_mode: "prorated_immediately",
        scheduled_change: null,
      },
    });

    fetchSpy.mockResolvedValueOnce(ok(subscription));
    await createPaddleClient(sandbox).updateSubscription("sub_1", { scheduledChange: null });
    expect(call(1).body).toEqual({ scheduled_change: null });
  });

  test("cancel, pause and resume post effective_from to their endpoints", async () => {
    const client = createPaddleClient(sandbox);
    fetchSpy.mockImplementation(() => Promise.resolve(ok(subscription)));

    await client.cancelSubscription("sub_1", "next_billing_period");
    await client.pauseSubscription("sub_1", {
      effectiveFrom: "next_billing_period",
      resumeAt: "2027-01-01T00:00:00Z",
    });
    await client.resumeSubscription("sub_1", "immediately");

    expect(call(0)).toMatchObject({
      url: `${BASE}/subscriptions/sub_1/cancel`,
      method: "POST",
      body: { effective_from: "next_billing_period" },
    });
    expect(call(1)).toMatchObject({
      url: `${BASE}/subscriptions/sub_1/pause`,
      method: "POST",
      body: { effective_from: "next_billing_period", resume_at: "2027-01-01T00:00:00Z" },
    });
    expect(call(2)).toMatchObject({
      url: `${BASE}/subscriptions/sub_1/resume`,
      method: "POST",
      body: { effective_from: "immediately" },
    });
  });

  test("getUpdatePaymentMethodTransaction returns the transaction checkout URL", async () => {
    fetchSpy.mockResolvedValueOnce(ok(transaction));
    const result = await createPaddleClient(sandbox).getUpdatePaymentMethodTransaction("sub_1");
    expect(result).toEqual({ id: "txn_1", checkout: { url: transaction.checkout.url } });
    expect(call()).toMatchObject({
      url: `${BASE}/subscriptions/sub_1/update-payment-method-transaction`,
      method: "GET",
    });
  });

  test("createPortalSession posts subscription ids and parses the portal URLs", async () => {
    const urls = {
      general: { overview: "https://customer-portal.paddle.com/cpl_1" },
      subscriptions: [
        {
          id: "sub_1",
          cancel_subscription: "https://customer-portal.paddle.com/cpl_1/cancel",
          update_subscription_payment_method: "https://customer-portal.paddle.com/cpl_1/pm",
        },
      ],
    };
    fetchSpy.mockResolvedValueOnce(ok({ id: "cpls_1", customer_id: "ctm_1", urls }));
    const result = await createPaddleClient(sandbox).createPortalSession("ctm_1", ["sub_1"]);

    expect(result).toEqual({ urls });
    expect(call()).toMatchObject({
      url: `${BASE}/customers/ctm_1/portal-sessions`,
      method: "POST",
      body: { subscription_ids: ["sub_1"] },
    });
  });

  test("path ids are URL-encoded", async () => {
    fetchSpy.mockResolvedValueOnce(ok(subscription));
    await createPaddleClient(sandbox).getSubscription("sub/../x");
    expect(call().url).toBe(`${BASE}/subscriptions/sub%2F..%2Fx`);
  });
});
