import { CheckoutEventNames, initializePaddle } from "@paddle/paddle-js";

import type { Environments, InitializePaddleOptions, Paddle } from "@paddle/paddle-js";

// The part of Paddle.js this page uses; narrow so tests can stand in for it.
type InitializeCheckout = (
  options: InitializePaddleOptions,
) => Promise<{ Checkout: Pick<Paddle["Checkout"], "open"> } | undefined>;

/**
 * Loads Paddle.js and opens the overlay checkout for a transaction. Resolves to false when
 * Paddle.js could not be loaded (blocked script, network error), so the page can show an error.
 */
export async function openPaddleCheckout({
  environment,
  token,
  transactionId,
  successUrl,
  onAbandoned,
  initialize = initializePaddle,
}: {
  environment: Environments;
  token: string;
  transactionId: string;
  successUrl: string;
  /** Called when the overlay is closed before the purchase completed. */
  onAbandoned: () => void;
  initialize?: InitializeCheckout;
}): Promise<boolean> {
  let completed = false;
  const paddle = await initialize({
    environment,
    token,
    eventCallback: (event) => {
      if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) completed = true;
      // After completion Paddle sends the customer to successUrl; don't race it.
      if (event.name === CheckoutEventNames.CHECKOUT_CLOSED && !completed) onAbandoned();
    },
  }).catch(() => undefined);
  if (!paddle) return false;

  // An explicit open takes priority over Paddle.js's own `_ptxn` handling, so it opens once and
  // with these settings.
  paddle.Checkout.open({
    transactionId,
    settings: { displayMode: "overlay", successUrl, allowLogout: false },
  });
  return true;
}
