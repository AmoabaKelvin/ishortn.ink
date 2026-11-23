import { describe, expect, test } from "bun:test";

import {
  createCheckoutWithPromoFallback,
  parseProviderUpdatedAt,
  providerErrorToClient,
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
    expect(await createCheckoutWithPromoFallback(create)).toBe(rejected);
    expect(calls).toEqual([undefined]);
  });

  test("a code that applies is sent once", async () => {
    const { calls, create } = recorder([ok]);
    expect(await createCheckoutWithPromoFallback(create, "BFCM20")).toBe(ok);
    expect(calls).toEqual(["BFCM20"]);
  });

  test("a rejected code retries once without it and returns the retry", async () => {
    const retried: Result = { error: null, statusCode: 201, url: "https://checkout/2" };
    const { calls, create } = recorder([rejected, retried]);
    const onPromoRejected: Result[] = [];

    const result = await createCheckoutWithPromoFallback(create, "BFCM20", (r) =>
      onPromoRejected.push(r),
    );

    expect(result).toBe(retried);
    expect(calls).toEqual(["BFCM20", undefined]);
    expect(onPromoRejected).toEqual([rejected]);
  });

  test.each([500, 429, null])("a %p failure is returned without a retry", async (statusCode) => {
    const failed: Result = { error: new Error("boom"), statusCode };
    const { calls, create } = recorder([failed]);
    expect(await createCheckoutWithPromoFallback(create, "BFCM20")).toBe(failed);
    expect(calls).toEqual(["BFCM20"]);
  });
});
