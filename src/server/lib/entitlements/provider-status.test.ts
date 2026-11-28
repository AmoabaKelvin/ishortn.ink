import { describe, expect, test } from "bun:test";

import { PaddleApiError } from "@/lib/paddle/client";

import {
  lookupProviderSubscription,
  ProviderNotConfiguredError,
  ProviderSubscriptionNotFoundError,
  providerEndedSubscription,
} from "./provider-status";

import type { PaddleSubscription } from "@/lib/paddle/client";

const NOW = new Date("2026-11-20T12:00:00Z");
const state = (status: string, endsAt: Date | null) => ({ status, endsAt, updatedAt: null });
const PAST = new Date("2026-11-10T00:00:00Z");
const FUTURE = new Date("2026-12-10T00:00:00Z");

describe("providerEndedSubscription", () => {
  test.each(["active", "on_trial", "past_due", "unpaid"])(
    "an expired subscription has ended for a local %s row",
    (local) => {
      expect(providerEndedSubscription(local, state("expired", PAST), NOW)).toBe(true);
      expect(providerEndedSubscription(local, state("expired", null), NOW)).toBe(true);
    },
  );

  test("a cancelled paid subscription ends only once ends_at has passed", () => {
    expect(providerEndedSubscription("active", state("cancelled", PAST), NOW)).toBe(true);
    expect(providerEndedSubscription("active", state("cancelled", FUTURE), NOW)).toBe(false);
    expect(providerEndedSubscription("active", state("cancelled", null), NOW)).toBe(false);
  });

  test("a cancelled failed renewal has ended whatever its ends_at", () => {
    expect(providerEndedSubscription("unpaid", state("cancelled", FUTURE), NOW)).toBe(true);
  });

  test.each(["active", "past_due", "unpaid", "paused", "on_trial"])(
    "a %s subscription at the provider has not ended",
    (status) => {
      expect(providerEndedSubscription("active", state(status, PAST), NOW)).toBe(false);
    },
  );
});

describe("lookupProviderSubscription: Paddle rows", () => {
  const row = { billingProvider: "paddle", subscriptionId: 0, providerSubscriptionId: "sub_01h8" };
  const paddleSub = (overrides: Partial<PaddleSubscription>): PaddleSubscription => ({
    id: "sub_01h8",
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
  const client = (result: PaddleSubscription | Error) => {
    const asked: string[] = [];
    return {
      asked,
      getSubscription: async (id: string) => {
        asked.push(id);
        if (result instanceof Error) throw result;
        return result;
      },
    };
  };

  test("reads the subscription from Paddle by its Paddle id", async () => {
    const paddle = client(paddleSub({}));
    expect(await lookupProviderSubscription(row, paddle)).toEqual({
      status: "active",
      endsAt: null,
      updatedAt: new Date("2026-11-19T09:00:00Z"),
    });
    expect(paddle.asked).toEqual(["sub_01h8"]);
  });

  test("a canceled subscription reads as expired, ending when it was canceled", async () => {
    const paddle = client(
      paddleSub({
        status: "canceled",
        canceled_at: "2026-11-19T08:00:00Z",
        next_billed_at: null,
      }),
    );
    expect(await lookupProviderSubscription(row, paddle)).toMatchObject({
      status: "expired",
      endsAt: new Date("2026-11-19T08:00:00Z"),
    });
  });

  test("a scheduled cancel reads as cancelled with its end date", async () => {
    const paddle = client(
      paddleSub({
        scheduled_change: {
          action: "cancel",
          effective_at: "2026-12-18T09:00:00Z",
          resume_at: null,
        },
      }),
    );
    expect(await lookupProviderSubscription(row, paddle)).toMatchObject({
      status: "cancelled",
      endsAt: new Date("2026-12-18T09:00:00Z"),
    });
  });

  test("a Paddle 404 is ProviderSubscriptionNotFoundError", async () => {
    const notFound = new PaddleApiError({
      method: "GET",
      path: "/subscriptions/sub_01h8",
      status: 404,
      code: "not_found",
      detail: "Entity not found",
      requestId: null,
    });
    const attempt = lookupProviderSubscription(row, client(notFound));
    await expect(attempt).rejects.toBeInstanceOf(ProviderSubscriptionNotFoundError);
  });

  test("other Paddle errors are rethrown", async () => {
    const down = new PaddleApiError({
      method: "GET",
      path: "/subscriptions/sub_01h8",
      status: 503,
      code: "unknown",
      detail: "Service Unavailable",
      requestId: null,
    });
    await expect(lookupProviderSubscription(row, client(down))).rejects.toBe(down);
  });

  test("throws ProviderNotConfiguredError while Paddle isn't configured", async () => {
    await expect(lookupProviderSubscription(row, null)).rejects.toBeInstanceOf(
      ProviderNotConfiguredError,
    );
  });
});
