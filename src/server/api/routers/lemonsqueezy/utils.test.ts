import { describe, expect, test } from "bun:test";

import { PaddleApiError } from "@/lib/paddle/client";

import {
  createCheckoutWithPromoFallback,
  lemonSqueezyPromoRejected,
  paddleErrorToClient,
  paddlePreviewCharge,
  paddlePromoRejected,
  parseProviderUpdatedAt,
  pauseUpdate,
  providerErrorToClient,
  resumeUpdate,
} from "./utils";

describe("providerErrorToClient", () => {
  test("missing subscription maps to NOT_FOUND", () => {
    expect(providerErrorToClient(404).code).toBe("NOT_FOUND");
  });

  test("rejected changes point at the payment method", () => {
    expect(providerErrorToClient(422)).toEqual({
      code: "BAD_REQUEST",
      message: expect.stringContaining("payment method"),
    });
  });

  test("rate limits map to TOO_MANY_REQUESTS", () => {
    expect(providerErrorToClient(429).code).toBe("TOO_MANY_REQUESTS");
  });

  test.each([500, 401, null])("%p falls back to a generic message", (status) => {
    expect(providerErrorToClient(status)).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Our payment provider is unavailable right now. Please try again in a few minutes.",
    });
  });
});

describe("paddleErrorToClient", () => {
  test.each([400, 409, 422])("a refused change (%p) maps like Lemon Squeezy's 422", (status) => {
    expect(paddleErrorToClient(status)).toEqual(providerErrorToClient(422));
  });

  test.each([404, 429, 500, null])("%p maps like providerErrorToClient", (status) => {
    expect(paddleErrorToClient(status)).toEqual(providerErrorToClient(status));
  });
});

describe("parseProviderUpdatedAt", () => {
  test("parses ISO timestamps", () => {
    expect(parseProviderUpdatedAt("2026-11-20T10:00:00.000000Z")?.toISOString()).toBe(
      "2026-11-20T10:00:00.000Z",
    );
  });

  test.each([null, undefined, "", "not a date"])("%p is null", (value) => {
    expect(parseProviderUpdatedAt(value)).toBeNull();
  });
});

describe("createCheckoutWithPromoFallback", () => {
  type Result = { error: Error | null; statusCode: number | null; url?: string };

  function recorder(results: Result[]) {
    const calls: (string | undefined)[] = [];
    const create = async (discountCode?: string) => {
      calls.push(discountCode);
      return results[calls.length - 1]!;
    };
    return { calls, create };
  }

  const ok: Result = { error: null, statusCode: 201, url: "https://checkout/1" };
  const rejected: Result = { error: new Error("code does not exist"), statusCode: 422 };

  test("without a code it calls once and never retries", async () => {
    const { calls, create } = recorder([rejected]);
    expect(await createCheckoutWithPromoFallback(create, lemonSqueezyPromoRejected)).toEqual({
      result: rejected,
      discountCode: undefined,
    });
    expect(calls).toEqual([undefined]);
  });

  test("a code that applies is sent once", async () => {
    const { calls, create } = recorder([ok]);
    const { result, discountCode } = await createCheckoutWithPromoFallback(
      create,
      lemonSqueezyPromoRejected,
      "BFCM20",
    );
    expect(result).toBe(ok);
    expect(discountCode).toBe("BFCM20");
    expect(calls).toEqual(["BFCM20"]);
  });

  test("a rejected code retries once without it and returns the retry", async () => {
    const retried: Result = { error: null, statusCode: 201, url: "https://checkout/2" };
    const { calls, create } = recorder([rejected, retried]);
    const onPromoRejected: Result[] = [];

    const { result, discountCode } = await createCheckoutWithPromoFallback(
      create,
      lemonSqueezyPromoRejected,
      "BFCM20",
      (r) => onPromoRejected.push(r),
    );

    expect(result).toBe(retried);
    expect(discountCode).toBeUndefined();
    expect(calls).toEqual(["BFCM20", undefined]);
    expect(onPromoRejected).toEqual([rejected]);
  });

  test.each([500, 429, null])("a %p failure is returned without a retry", async (statusCode) => {
    const failed: Result = { error: new Error("boom"), statusCode };
    const { calls, create } = recorder([failed]);
    const { result, discountCode } = await createCheckoutWithPromoFallback(
      create,
      lemonSqueezyPromoRejected,
      "BFCM20",
    );
    expect(result).toBe(failed);
    expect(discountCode).toBe("BFCM20");
    expect(calls).toEqual(["BFCM20"]);
  });
});

describe("paddlePromoRejected", () => {
  const paddleError = (status: number, code: string) => ({
    error: new PaddleApiError({
      method: "POST",
      path: "/transactions",
      status,
      code,
      detail: "detail",
      requestId: null,
    }),
  });

  test.each([
    [400, "transaction_discount_not_eligible"],
    [400, "discount_expired"],
    [409, "discount_usage_limit_reached"],
  ])("a %p %s is a rejected discount", (status, code) => {
    expect(paddlePromoRejected(paddleError(status, code))).toBe(true);
  });

  test.each([
    [400, "transaction_price_not_found"],
    [500, "discount_internal_error"],
    [429, "too_many_requests"],
  ])("a %p %s is not", (status, code) => {
    expect(paddlePromoRejected(paddleError(status, code))).toBe(false);
  });

  test("non-Paddle errors and successes are not", () => {
    expect(paddlePromoRejected({ error: new Error("discount") })).toBe(false);
    expect(paddlePromoRejected({ error: null })).toBe(false);
  });
});

describe("pauseUpdate", () => {
  test("voids invoices until the resume date", () => {
    expect(pauseUpdate(new Date("2026-12-23T10:00:00Z"))).toEqual({
      pause: { mode: "void", resumesAt: "2026-12-23T10:00:00.000Z" },
    });
  });
});

describe("resumeUpdate", () => {
  test("a paused subscription is unpaused", () => {
    expect(resumeUpdate("paused")).toEqual({ pause: null });
  });

  test("a cancelled subscription is uncancelled", () => {
    expect(resumeUpdate("cancelled")).toEqual({ cancelled: false });
  });
});

describe("paddlePreviewCharge", () => {
  const preview = (grandTotal: string, currencyCode = "USD") => ({
    immediate_transaction: {
      details: { totals: { grand_total: grandTotal, currency_code: currencyCode } },
    },
  });

  test("reads the prorated, discounted amount due now", () => {
    expect(paddlePreviewCharge(preview("609"))).toEqual({
      type: "amount_due",
      amount: 609,
      currencyCode: "USD",
    });
  });

  test("a change fully covered by credit is due as zero", () => {
    expect(paddlePreviewCharge(preview("0", "EUR"))).toEqual({
      type: "amount_due",
      amount: 0,
      currencyCode: "EUR",
    });
  });

  test("no immediate transaction or an unreadable total falls back to prorated", () => {
    expect(paddlePreviewCharge({ immediate_transaction: null })).toEqual({ type: "prorated" });
    expect(paddlePreviewCharge(preview("6.09"))).toEqual({ type: "prorated" });
    expect(paddlePreviewCharge(preview(""))).toEqual({ type: "prorated" });
  });
});
