import { describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";

import { assertCanCreateKeys } from "./utils";

import type { Subscription } from "@/server/db/schema";

const NOW = new Date("2026-11-25T12:00:00Z");

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 1,
    userId: "user_1",
    orderId: 10,
    subscriptionId: 100,
    customerId: 1000,
    renewsAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: null,
    status: "active",
    plan: "pro",
    billingInterval: "monthly",
    variantId: 1811616,
    productId: 0,
    providerUpdatedAt: null,
    cardBrand: "visa",
    cardLastFour: "4242",
    ...overrides,
  };
}

function creationError(subscription: Subscription | null) {
  try {
    assertCanCreateKeys(subscription, NOW);
    return null;
  } catch (error) {
    return error;
  }
}

describe("assertCanCreateKeys", () => {
  test("Free accounts can't create keys", () => {
    const error = creationError(null);
    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "API access is a Pro feature. Upgrade to Pro to create API keys.",
    });
  });

  test("lapsed accounts can't create keys", () => {
    const lapsed = sub({ status: "cancelled", endsAt: new Date(NOW.getTime() - 1000) });
    expect(creationError(lapsed)).toMatchObject({ code: "FORBIDDEN" });
    expect(creationError(sub({ status: "expired" }))).toMatchObject({ code: "FORBIDDEN" });
  });

  test("Pro and Ultra accounts create keys, including cancelled ones still in their paid period", () => {
    expect(creationError(sub({}))).toBeNull();
    expect(creationError(sub({ plan: "ultra" }))).toBeNull();
    expect(
      creationError(sub({ status: "cancelled", endsAt: new Date(NOW.getTime() + 1000) })),
    ).toBeNull();
  });
});
