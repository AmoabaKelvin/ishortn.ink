import { describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";

import { PaddleApiError } from "@/lib/paddle/client";

import { CANCEL_FAILED_MESSAGE, cancelPaddleSubscriptionForDeletion } from "./utils";

import type { PaddleEffectiveFrom, PaddleSubscription } from "@/lib/paddle/client";

const SUB_ID = "sub_01h8";
const CANCELED_AT = "2026-11-27T10:00:00Z";

const paddleSub = (overrides: Partial<PaddleSubscription>): PaddleSubscription => ({
  id: SUB_ID,
  status: "active",
  customer_id: "ctm_01h8",
  items: [{ price: { id: "pri_unknown" } }],
  scheduled_change: null,
  current_billing_period: null,
  next_billed_at: "2026-12-18T09:00:00Z",
  started_at: "2026-11-18T09:00:00Z",
  created_at: "2026-11-18T09:00:00Z",
  updated_at: "2026-11-19T09:00:00Z",
  custom_data: null,
  ...overrides,
});

const canceled = paddleSub({
  status: "canceled",
  canceled_at: CANCELED_AT,
  next_billed_at: null,
  updated_at: CANCELED_AT,
});

const locked = new PaddleApiError({
  method: "POST",
  path: `/subscriptions/${SUB_ID}/cancel`,
  status: 400,
  code: "subscription_locked_pending_changes",
  detail: "Subscription is locked",
  requestId: null,
});

function client(input: {
  cancel: PaddleSubscription | Error;
  current?: PaddleSubscription | Error;
}) {
  const cancels: [string, PaddleEffectiveFrom][] = [];
  return {
    cancels,
    cancelSubscription: async (id: string, effectiveFrom: PaddleEffectiveFrom) => {
      cancels.push([id, effectiveFrom]);
      if (input.cancel instanceof Error) throw input.cancel;
      return input.cancel;
    },
    getSubscription: async () => {
      if (!input.current || input.current instanceof Error) {
        throw input.current ?? new Error("not expected");
      }
      return input.current;
    },
  };
}

describe("cancelPaddleSubscriptionForDeletion", () => {
  test("cancels the subscription immediately and returns it as expired", async () => {
    const paddle = client({ cancel: canceled });
    expect(await cancelPaddleSubscriptionForDeletion(paddle, SUB_ID, "u1")).toEqual({
      status: "expired",
      endsAt: new Date(CANCELED_AT),
      updatedAt: new Date(CANCELED_AT),
    });
    expect(paddle.cancels).toEqual([[SUB_ID, "immediately"]]);
  });

  test("proceeds when the cancel fails but the subscription is already canceled", async () => {
    const paddle = client({ cancel: locked, current: canceled });
    expect(await cancelPaddleSubscriptionForDeletion(paddle, SUB_ID, "u1")).toMatchObject({
      status: "expired",
    });
  });

  test("refuses when the cancel fails and the subscription is still live", async () => {
    const paddle = client({ cancel: locked, current: paddleSub({}) });
    const attempt = cancelPaddleSubscriptionForDeletion(paddle, SUB_ID, "u1");
    await expect(attempt).rejects.toBeInstanceOf(TRPCError);
    await expect(attempt).rejects.toMatchObject({ message: CANCEL_FAILED_MESSAGE });
  });

  test("refuses when a scheduled cancel hasn't taken effect yet", async () => {
    const scheduled = paddleSub({
      scheduled_change: { action: "cancel", effective_at: "2026-12-18T09:00:00Z", resume_at: null },
    });
    const paddle = client({ cancel: locked, current: scheduled });
    await expect(cancelPaddleSubscriptionForDeletion(paddle, SUB_ID, "u1")).rejects.toMatchObject({
      message: CANCEL_FAILED_MESSAGE,
    });
  });

  test("refuses when neither the cancel nor the read succeeds", async () => {
    const paddle = client({ cancel: locked, current: new Error("Paddle down") });
    await expect(cancelPaddleSubscriptionForDeletion(paddle, SUB_ID, "u1")).rejects.toMatchObject({
      message: CANCEL_FAILED_MESSAGE,
    });
  });

  test("refuses while Paddle isn't configured", async () => {
    await expect(cancelPaddleSubscriptionForDeletion(null, SUB_ID, "u1")).rejects.toMatchObject({
      message: CANCEL_FAILED_MESSAGE,
    });
  });
});
