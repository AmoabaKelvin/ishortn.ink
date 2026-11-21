import { describe, expect, test } from "bun:test";

import { parseProviderUpdatedAt, providerErrorToClient } from "./utils";

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
