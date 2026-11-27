import { describe, expect, test } from "bun:test";

import { CheckoutEventNames } from "@paddle/paddle-js";

import { openPaddleCheckout } from "./open-paddle-checkout";

import type {
  CheckoutOpenOptions,
  InitializePaddleOptions,
  PaddleEventData,
} from "@paddle/paddle-js";

const SUCCESS_URL = "https://ishortn.ink/dashboard/settings?checkout=success#billing";

// Stands in for Paddle.js: records the options it was initialised with and every Checkout.open.
function fakePaddle(result: "loaded" | "undefined" | "rejected" = "loaded") {
  const opened: CheckoutOpenOptions[] = [];
  let options: InitializePaddleOptions | undefined;
  const paddle = { Checkout: { open: (o: CheckoutOpenOptions) => void opened.push(o) } };
  const initialize = async (o: InitializePaddleOptions) => {
    options = o;
    if (result === "rejected") throw new Error("script failed to load");
    return result === "loaded" ? paddle : undefined;
  };
  const emit = (name: CheckoutEventNames) => {
    // SAFETY: the callback only reads `name`.
    options?.eventCallback?.({ name } as PaddleEventData);
  };
  return { opened, initialize, emit, options: () => options };
}

const open = (fake: ReturnType<typeof fakePaddle>, onAbandoned = () => {}) =>
  openPaddleCheckout({
    environment: "sandbox",
    token: "test_abc",
    transactionId: "txn_01hv8wptq8987qeep44cyrewp9",
    successUrl: SUCCESS_URL,
    onAbandoned,
    initialize: fake.initialize,
  });

describe("openPaddleCheckout", () => {
  test("initialises Paddle.js and opens the overlay for the transaction", async () => {
    const fake = fakePaddle();
    expect(await open(fake)).toBe(true);
    expect(fake.options()).toMatchObject({ environment: "sandbox", token: "test_abc" });
    expect(fake.opened).toEqual([
      {
        transactionId: "txn_01hv8wptq8987qeep44cyrewp9",
        settings: { displayMode: "overlay", successUrl: SUCCESS_URL, allowLogout: false },
      },
    ]);
  });

  test("reports abandonment when the overlay closes before completion", async () => {
    const fake = fakePaddle();
    let abandoned = 0;
    await open(fake, () => abandoned++);
    fake.emit(CheckoutEventNames.CHECKOUT_LOADED);
    fake.emit(CheckoutEventNames.CHECKOUT_CLOSED);
    expect(abandoned).toBe(1);
  });

  test("does not report abandonment once the checkout completed", async () => {
    const fake = fakePaddle();
    let abandoned = 0;
    await open(fake, () => abandoned++);
    fake.emit(CheckoutEventNames.CHECKOUT_COMPLETED);
    fake.emit(CheckoutEventNames.CHECKOUT_CLOSED);
    expect(abandoned).toBe(0);
  });

  test("resolves false without opening when Paddle.js does not load", async () => {
    for (const result of ["undefined", "rejected"] as const) {
      const fake = fakePaddle(result);
      expect(await open(fake)).toBe(false);
      expect(fake.opened).toEqual([]);
    }
  });
});
