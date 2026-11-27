import { describe, expect, test } from "bun:test";

import { parseTransactionId } from "./transaction-id";

describe("parseTransactionId", () => {
  test("accepts a Paddle transaction id", () => {
    expect(parseTransactionId("txn_x")).toBe("txn_x");
    expect(parseTransactionId("txn_01hv8wptq8987qeep44cyrewp9")).toBe(
      "txn_01hv8wptq8987qeep44cyrewp9",
    );
  });

  test("rejects missing, repeated and non-transaction values", () => {
    for (const value of [
      undefined,
      "",
      "txn_",
      "sub_01hv8x29kz0t586xy6zn1a62ny",
      "TXN_abc",
      "txn_abc/../x",
      "txn_abc def",
      ["txn_a", "txn_b"],
    ]) {
      expect(parseTransactionId(value)).toBeNull();
    }
  });
});
