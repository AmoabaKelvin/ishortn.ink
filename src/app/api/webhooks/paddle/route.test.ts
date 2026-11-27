import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { buildPaddleConfig } from "@/lib/paddle/config";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import * as billingEmails from "@/server/lib/notifications/billing";

import { stubCloudflareContext } from "../../../../../test/cloudflare-context";
import { eventKind, handlePaddleWebhook } from "./handler";

import type { PaddleWebhookDeps } from "./handler";
import type { Mock } from "bun:test";

const SECRET = "pdl_ntfset_route_test_secret";
const USER_ID = "paddle_route_test";
const USER_EMAIL = "paddle-route-test@example.com";
const CUSTOMER_ID = "ctm_01routetest931";
const SUBSCRIPTION_ID = "sub_01routetest931";
const PRICES = {
  proMonthly: "pri_01pro_monthly",
  proAnnual: "pri_01pro_annual",
  ultraMonthly: "pri_01ultra_monthly",
  ultraAnnual: "pri_01ultra_annual",
};

const config = buildPaddleConfig({
  BILLING_PROVIDER: undefined,
  PADDLE_ENVIRONMENT: "sandbox",
  PADDLE_API_KEY: "pdl_sdbx_route_test",
  PADDLE_WEBHOOK_SECRET: SECRET,
  PADDLE_CLIENT_TOKEN: "test_route_test",
  PADDLE_PRICE_PRO_MONTHLY: PRICES.proMonthly,
  PADDLE_PRICE_PRO_ANNUAL: PRICES.proAnnual,
  PADDLE_PRICE_ULTRA_MONTHLY: PRICES.ultraMonthly,
  PADDLE_PRICE_ULTRA_ANNUAL: PRICES.ultraAnnual,
  PADDLE_PRICE_PRO_LEGACY_MONTHLY: undefined,
  PADDLE_CHECKOUT_USER_IDS: undefined,
});

const customerLookups: string[] = [];
let customerEmail = USER_EMAIL;
const deps: PaddleWebhookDeps = {
  config,
  client: {
    getCustomer: async (id) => {
      customerLookups.push(id);
      return { id, email: customerEmail, name: null };
    },
  },
};

function sign(body: string, ts = Math.floor(Date.now() / 1000)) {
  const h1 = crypto.createHmac("sha256", SECRET).update(`${ts}:${body}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
}

type SubscriptionOverrides = Partial<{
  status: string;
  price: string;
  scheduled_change: { action: string; effective_at: string; resume_at: string | null } | null;
  canceled_at: string | null;
  custom_data: Record<string, string> | null;
}>;

function event(
  eventType: string,
  updatedAt: string,
  { price = PRICES.proAnnual, ...overrides }: SubscriptionOverrides = {},
) {
  return JSON.stringify({
    event_id: `evt_${crypto.randomUUID()}`,
    event_type: eventType,
    occurred_at: updatedAt,
    notification_id: `ntf_${crypto.randomUUID()}`,
    data: {
      id: SUBSCRIPTION_ID,
      status: "active",
      customer_id: CUSTOMER_ID,
      created_at: "2026-11-20T00:00:00Z",
      updated_at: updatedAt,
      next_billed_at: "2027-11-20T00:00:00Z",
      canceled_at: null,
      scheduled_change: null,
      items: [{ price: { id: price }, quantity: 1 }],
      custom_data: { user_id: USER_ID },
      ...overrides,
    },
  });
}

function deliver(
  body: string,
  signature: string | null = sign(body),
  handlerDeps: PaddleWebhookDeps = deps,
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature !== null) headers.set("Paddle-Signature", signature);
  return handlePaddleWebhook(
    new Request("http://localhost/api/webhooks/paddle", { method: "POST", headers, body }),
    handlerDeps,
  );
}

describe("eventKind", () => {
  const active = { status: "active" };
  const cancelled = { status: "cancelled" };

  test("maps lifecycle events to applier kinds", () => {
    expect(eventKind("subscription.created", active)).toBe("created");
    expect(eventKind("subscription.imported", active)).toBe("created");
    expect(eventKind("subscription.canceled", { status: "expired" })).toBe("expired");
    for (const type of [
      "subscription.updated",
      "subscription.activated",
      "subscription.trialing",
      "subscription.past_due",
      "subscription.paused",
      "subscription.resumed",
    ]) {
      expect(eventKind(type, active)).toBe("updated");
    }
  });

  test("an update into the cancelled status is a cancellation", () => {
    expect(eventKind("subscription.updated", cancelled)).toBe("cancelled");
  });

  test("an update into the expired status is an expiry", () => {
    expect(eventKind("subscription.updated", { status: "expired" })).toBe("expired");
  });

  test("other events carry nothing to apply", () => {
    expect(eventKind("subscription.something_new", active)).toBeNull();
  });
});

describe("POST /api/webhooks/paddle without a database", () => {
  const body = event("subscription.updated", "2026-11-20T00:00:00Z");

  test("responds 404 while Paddle is not configured", async () => {
    const response = await deliver(body, sign(body), { config: null, client: null });
    expect(response.status).toBe(404);
  });

  test("rejects a missing signature with 401", async () => {
    expect((await deliver(body, null)).status).toBe(401);
  });

  test("rejects a wrong signature with 401", async () => {
    expect((await deliver(body, sign(`${body} `))).status).toBe(401);
  });

  test("rejects a signature older than the tolerance with 401", async () => {
    expect((await deliver(body, sign(body, Math.floor(Date.now() / 1000) - 60))).status).toBe(401);
  });

  test("rejects a malformed envelope with 400", async () => {
    const malformed = JSON.stringify({ event_type: "subscription.updated" });
    expect((await deliver(malformed)).status).toBe(400);
  });

  test("acknowledges events it does not handle", async () => {
    const other = JSON.stringify({
      event_id: "evt_1",
      event_type: "transaction.completed",
      occurred_at: "2026-11-20T00:00:00Z",
      notification_id: "ntf_1",
      data: { id: "txn_1" },
    });
    expect((await deliver(other)).status).toBe(200);
  });

  test("acknowledges an unhandled subscription event without reading its data", async () => {
    const other = JSON.stringify({
      event_id: "evt_2",
      event_type: "subscription.something_new",
      occurred_at: "2026-11-20T00:00:00Z",
      notification_id: "ntf_2",
      data: { id: "sub_1" },
    });
    expect((await deliver(other)).status).toBe(200);
  });

  test("rejects a handled event with a malformed subscription with 400", async () => {
    const malformed = JSON.stringify({
      event_id: "evt_3",
      event_type: "subscription.updated",
      occurred_at: "2026-11-20T00:00:00Z",
      notification_id: "ntf_3",
      data: { id: "sub_1" },
    });
    expect((await deliver(malformed)).status).toBe(400);
  });
});

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("POST /api/webhooks/paddle (MySQL)", () => {
  let restoreContext = () => {};
  let welcomeSpy: Mock<typeof billingEmails.sendWelcomeEmail>;
  let cancelledSpy: Mock<typeof billingEmails.sendSubscriptionCancelledEmail>;

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    // Emails go out through runBackgroundTask, which needs the Cloudflare context.
    restoreContext = stubCloudflareContext();
    welcomeSpy = spyOn(billingEmails, "sendWelcomeEmail").mockResolvedValue(true);
    cancelledSpy = spyOn(billingEmails, "sendSubscriptionCancelledEmail").mockResolvedValue(true);
  });

  async function reset() {
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await db.insert(schema.user).values({ id: USER_ID, email: USER_EMAIL });
    welcomeSpy.mockClear();
    cancelledSpy.mockClear();
    customerLookups.length = 0;
    customerEmail = USER_EMAIL;
  }

  function storedSubscription() {
    return db.query.subscription.findFirst({
      where: eq(schema.subscription.userId, USER_ID),
    });
  }

  // Background emails start after the response; let them run before asserting.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  beforeEach(reset);

  afterAll(async () => {
    welcomeSpy.mockRestore();
    cancelledSpy.mockRestore();
    restoreContext();
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  });

  test("created writes a Paddle row with the plan and interval from the price", async () => {
    expect((await deliver(event("subscription.created", "2026-11-20T00:00:00Z"))).status).toBe(200);

    const row = await storedSubscription();
    expect(row).toMatchObject({
      billingProvider: "paddle",
      providerSubscriptionId: SUBSCRIPTION_ID,
      providerCustomerId: CUSTOMER_ID,
      providerPriceId: PRICES.proAnnual,
      subscriptionId: 0,
      status: "active",
      plan: "pro",
      billingInterval: "annual",
    });
    expect(row?.renewsAt?.toISOString()).toBe("2027-11-20T00:00:00.000Z");
    await settle();
    expect(welcomeSpy).toHaveBeenCalledTimes(1);
  });

  test("imported writes the row without a welcome email", async () => {
    const body = event("subscription.imported", "2026-11-20T00:00:00Z", {
      price: PRICES.ultraMonthly,
    });
    expect((await deliver(body)).status).toBe(200);

    expect(await storedSubscription()).toMatchObject({ plan: "ultra", billingInterval: "monthly" });
    await settle();
    expect(welcomeSpy).not.toHaveBeenCalled();
  });

  test("a scheduled cancel marks the row cancelled until the period ends, emailing once", async () => {
    await deliver(event("subscription.created", "2026-11-20T00:00:00Z"));
    const scheduledCancel = {
      scheduled_change: {
        action: "cancel",
        effective_at: "2027-11-20T00:00:00Z",
        resume_at: null,
      },
    };

    for (const updatedAt of ["2026-11-21T00:00:00Z", "2026-11-22T00:00:00Z"]) {
      const response = await deliver(event("subscription.updated", updatedAt, scheduledCancel));
      expect(response.status).toBe(200);
    }

    const row = await storedSubscription();
    expect(row?.status).toBe("cancelled");
    expect(row?.plan).toBe("pro");
    expect(row?.endsAt?.toISOString()).toBe("2027-11-20T00:00:00.000Z");
    await settle();
    expect(cancelledSpy).toHaveBeenCalledTimes(1);
  });

  test("canceled resets the row to free and starts the lapse grace", async () => {
    await deliver(event("subscription.created", "2026-11-20T00:00:00Z"));

    const body = event("subscription.canceled", "2026-11-21T00:00:00Z", {
      status: "canceled",
      canceled_at: "2026-11-21T00:00:00Z",
    });
    expect((await deliver(body)).status).toBe(200);

    const row = await storedSubscription();
    expect(row?.status).toBe("expired");
    expect(row?.plan).toBe("free");
    const account = await db.query.user.findFirst({ where: eq(schema.user.id, USER_ID) });
    expect(account?.planGracePlan).toBe("pro");
    expect(account?.planGraceReason).toBe("lapsed");
    expect(account?.planGraceEndsAt).not.toBeNull();
  });

  test("an update to canceled followed by canceled resets the row to free once", async () => {
    await deliver(event("subscription.created", "2026-11-20T00:00:00Z"));
    const canceled = { status: "canceled", canceled_at: "2026-11-21T00:00:00Z" };

    const update = event("subscription.updated", "2026-11-21T00:00:00Z", canceled);
    expect((await deliver(update)).status).toBe(200);
    const final = event("subscription.canceled", "2026-11-21T00:00:00Z", canceled);
    expect((await deliver(final)).status).toBe(200);

    const row = await storedSubscription();
    expect(row?.status).toBe("expired");
    expect(row?.plan).toBe("free");
    const account = await db.query.user.findFirst({ where: eq(schema.user.id, USER_ID) });
    expect(account?.planGracePlan).toBe("pro");
    expect(account?.planGraceReason).toBe("lapsed");
    expect(account?.planGraceEndsAt).not.toBeNull();
  });

  test("a redelivered older event is acknowledged without changing the row", async () => {
    const older = event("subscription.past_due", "2026-11-20T00:00:00Z", { status: "past_due" });
    await deliver(event("subscription.created", "2026-11-20T00:00:00Z"));
    await deliver(event("subscription.updated", "2026-11-22T00:00:00Z"));

    expect((await deliver(older)).status).toBe(200);
    expect((await storedSubscription())?.status).toBe("active");
  });

  test("created replaces an expired Lemon Squeezy row", async () => {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      subscriptionId: 931001,
      customerId: 931002,
      status: "expired",
      plan: "free",
      providerUpdatedAt: new Date("2026-12-01T00:00:00Z"),
    });

    expect((await deliver(event("subscription.created", "2026-11-20T00:00:00Z"))).status).toBe(200);

    expect(await storedSubscription()).toMatchObject({
      billingProvider: "paddle",
      providerSubscriptionId: SUBSCRIPTION_ID,
      subscriptionId: 0,
      customerId: 0,
      status: "active",
      plan: "pro",
    });
  });

  test("an update for a user on Lemon Squeezy leaves their row alone", async () => {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      subscriptionId: 931001,
      customerId: 931002,
      status: "active",
      plan: "pro",
      providerUpdatedAt: new Date("2026-11-19T00:00:00Z"),
    });

    const body = event("subscription.paused", "2026-11-20T00:00:00Z", { status: "paused" });
    expect((await deliver(body)).status).toBe(200);
    expect(await storedSubscription()).toMatchObject({
      billingProvider: "lemonsqueezy",
      status: "active",
    });
  });

  test("matches an event without user_id by customer, without calling Paddle", async () => {
    await deliver(event("subscription.created", "2026-11-20T00:00:00Z"));

    const body = event("subscription.past_due", "2026-11-21T00:00:00Z", {
      status: "past_due",
      custom_data: null,
    });
    expect((await deliver(body)).status).toBe(200);
    expect((await storedSubscription())?.status).toBe("past_due");
    expect(customerLookups).toEqual([]);
  });

  test("matches an event without user_id by the Paddle customer's email", async () => {
    const body = event("subscription.created", "2026-11-20T00:00:00Z", { custom_data: null });
    expect((await deliver(body)).status).toBe(200);
    expect(customerLookups).toEqual([CUSTOMER_ID]);
    expect((await storedSubscription())?.providerSubscriptionId).toBe(SUBSCRIPTION_ID);
  });

  test("acknowledges an event that matches no user, without writing", async () => {
    customerEmail = "no-such-user-931@example.com";
    const body = event("subscription.created", "2026-11-20T00:00:00Z", { custom_data: null });
    expect((await deliver(body)).status).toBe(200);
    expect(await storedSubscription()).toBeUndefined();
  });

  test("responds 500 when the Paddle API fails, so the event is retried", async () => {
    const failing: PaddleWebhookDeps = {
      config,
      client: {
        getCustomer: async () => {
          throw new Error("Paddle unavailable");
        },
      },
    };
    const body = event("subscription.created", "2026-11-20T00:00:00Z", { custom_data: null });
    expect((await deliver(body, sign(body), failing)).status).toBe(500);
    expect(await storedSubscription()).toBeUndefined();
  });
});
