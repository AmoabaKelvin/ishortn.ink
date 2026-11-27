import { describe, expect, test } from "bun:test";

import { buildPaddleConfig } from "./config";
import { normalizePaddleSubscription, paddleSubscriptionSchema } from "./normalize";

import type { PaddleEnv } from "./config";
import type { PaddleSubscription } from "./normalize";
import type { z } from "zod";

type PaddleSubscriptionPayload = z.input<typeof paddleSubscriptionSchema>;

const config = buildPaddleConfig({
  BILLING_PROVIDER: "lemonsqueezy",
  PADDLE_ENVIRONMENT: "sandbox",
  PADDLE_API_KEY: "pdl_sdbx_apikey_123",
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_secret",
  PADDLE_CLIENT_TOKEN: "test_clienttoken",
  PADDLE_PRICE_PRO_MONTHLY: "pri_pro_m",
  PADDLE_PRICE_PRO_ANNUAL: "pri_pro_y",
  PADDLE_PRICE_ULTRA_MONTHLY: "pri_ultra_m",
  PADDLE_PRICE_ULTRA_ANNUAL: "pri_ultra_y",
  PADDLE_PRICE_PRO_LEGACY_MONTHLY: undefined,
  PADDLE_CHECKOUT_USER_IDS: undefined,
} satisfies PaddleEnv);

const NEXT = "2026-12-27T10:00:00.000Z";
const LATER = "2027-01-15T00:00:00.000Z";
const UPDATED = "2026-11-27T10:00:00.000Z";

// Parsed like a webhook payload would be, so custom_data goes through the schema.
function sub(overrides: Partial<PaddleSubscriptionPayload> = {}): PaddleSubscription {
  return paddleSubscriptionSchema.parse({
    id: "sub_01",
    status: "active",
    customer_id: "ctm_01",
    created_at: "2026-11-01T10:00:00.000Z",
    updated_at: UPDATED,
    next_billed_at: NEXT,
    canceled_at: null,
    scheduled_change: null,
    items: [{ price: { id: "pri_ultra_y" } }],
    custom_data: { user_id: "user_123" },
    ...overrides,
  });
}

const normalize = (overrides: Partial<PaddleSubscriptionPayload> = {}) =>
  normalizePaddleSubscription(sub(overrides), config);

describe("normalizePaddleSubscription", () => {
  test("active with no scheduled change", () => {
    expect(normalize()).toEqual({
      providerSubscriptionId: "sub_01",
      providerCustomerId: "ctm_01",
      providerPriceId: "pri_ultra_y",
      plan: "ultra",
      interval: "annual",
      status: "active",
      renewsAt: new Date(NEXT),
      endsAt: null,
      pausedUntil: null,
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      providerUpdatedAt: new Date(UPDATED),
      userIdHint: "user_123",
      unrecognisedPrice: false,
    });
  });

  test("trialing → on_trial, renews at next_billed_at", () => {
    const result = normalize({ status: "trialing" });
    expect(result.status).toBe("on_trial");
    expect(result.renewsAt).toEqual(new Date(NEXT));
    expect(result.endsAt).toBeNull();
  });

  test("active with a scheduled cancel → cancelled, ends at effective_at", () => {
    const result = normalize({
      next_billed_at: null,
      scheduled_change: { action: "cancel", effective_at: NEXT, resume_at: null },
    });
    expect(result.status).toBe("cancelled");
    expect(result.endsAt).toEqual(new Date(NEXT));
    expect(result.renewsAt).toBeNull();
    expect(result.pausedUntil).toBeNull();
  });

  test("active with a scheduled pause stays active with pausedUntil = resume_at", () => {
    const result = normalize({
      scheduled_change: { action: "pause", effective_at: NEXT, resume_at: LATER },
    });
    expect(result.status).toBe("active");
    expect(result.pausedUntil).toEqual(new Date(LATER));
    expect(result.renewsAt).toEqual(new Date(NEXT));
    expect(result.endsAt).toBeNull();
  });

  test("a scheduled pause keeps its start date although Paddle clears next_billed_at", () => {
    const result = normalize({
      next_billed_at: null,
      scheduled_change: { action: "pause", effective_at: NEXT, resume_at: LATER },
    });
    expect(result.renewsAt).toEqual(new Date(NEXT));
    expect(result.pausedUntil).toEqual(new Date(LATER));
  });

  test("past_due keeps its status and the active dates", () => {
    const result = normalize({ status: "past_due" });
    expect(result.status).toBe("past_due");
    expect(result.renewsAt).toEqual(new Date(NEXT));
    expect(result.endsAt).toBeNull();
  });

  test("paused with a scheduled resume", () => {
    const resume = normalize({
      status: "paused",
      next_billed_at: null,
      scheduled_change: { action: "resume", effective_at: LATER, resume_at: null },
    });
    expect(resume.status).toBe("paused");
    expect(resume.pausedUntil).toEqual(new Date(LATER));
    expect(resume.renewsAt).toBeNull();

    const withResumeAt = normalize({
      status: "paused",
      scheduled_change: { action: "pause", effective_at: UPDATED, resume_at: LATER },
    });
    expect(withResumeAt.pausedUntil).toEqual(new Date(LATER));
  });

  test("paused indefinitely", () => {
    const result = normalize({ status: "paused", next_billed_at: null });
    expect(result.status).toBe("paused");
    expect(result.pausedUntil).toBeNull();
  });

  test("canceled → expired, ends at canceled_at, falling back to updated_at", () => {
    const canceledAt = "2026-11-20T08:00:00.000Z";
    const result = normalize({ status: "canceled", next_billed_at: null, canceled_at: canceledAt });
    expect(result.status).toBe("expired");
    expect(result.endsAt).toEqual(new Date(canceledAt));
    expect(result.renewsAt).toBeNull();

    expect(normalize({ status: "canceled", canceled_at: null }).endsAt).toEqual(new Date(UPDATED));
  });

  test("unknown price falls back to custom_data, then Pro monthly, and flags it", () => {
    const fromCustomData = normalize({
      items: [{ price: { id: "pri_unknown" } }],
      custom_data: { user_id: "user_123", plan: "ultra", interval: "annual" },
    });
    expect(fromCustomData).toMatchObject({
      providerPriceId: "pri_unknown",
      plan: "ultra",
      interval: "annual",
      unrecognisedPrice: true,
    });

    const defaulted = normalize({ items: [], custom_data: { plan: "enterprise", interval: 12 } });
    expect(defaulted).toMatchObject({
      providerPriceId: null,
      plan: "pro",
      interval: "monthly",
      unrecognisedPrice: true,
      userIdHint: null,
    });

    expect(normalizePaddleSubscription(sub(), null).unrecognisedPrice).toBe(true);
  });

  test("unparseable updated_at gives a null providerUpdatedAt", () => {
    expect(normalize({ updated_at: "not a date" }).providerUpdatedAt).toBeNull();
  });
});
