import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { stubCloudflareContext } from "../../../../../test/cloudflare-context";
import { POST } from "./route";

import type { Mock } from "bun:test";

const SECRET = "lemonsqueezy-route-test-secret";
const USER_ID = "lemonsqueezy_route_test";
const USER_EMAIL = "lemonsqueezy-route-test@example.com";
const CUSTOMER_ID = 942001;
const SUBSCRIPTION_ID = 942002;
const PRO_ANNUAL_VARIANT = 1809620;

beforeAll(() => {
  Object.assign(env, { LEMONSQUEEZY_WEBHOOK_SECRET: SECRET });
});

function sign(body: string) {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

function subscriptionEvent(
  eventName: string,
  updatedAt: string,
  customData: { user_id?: string } | null = { user_id: USER_ID },
  attributes: Partial<{
    status: string;
    card_last_four: string;
    user_email: string;
    pause: { mode: string; resumes_at: string | null } | null;
  }> = {},
) {
  return JSON.stringify({
    meta: { event_name: eventName, custom_data: customData },
    data: {
      id: String(SUBSCRIPTION_ID),
      attributes: {
        customer_id: CUSTOMER_ID,
        order_id: 1,
        product_id: 1,
        variant_id: 1,
        status: "active",
        user_email: USER_EMAIL,
        card_brand: "visa",
        card_last_four: "4242",
        renews_at: "2026-12-20T00:00:00Z",
        ends_at: null,
        created_at: "2026-11-20T00:00:00Z",
        updated_at: updatedAt,
        ...attributes,
      },
    },
  });
}

function deliver(body: string, signature: string | null = sign(body)) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature !== null) headers.set("X-Signature", signature);
  return POST(
    new Request("http://localhost/api/webhooks/lemonsqueezy", {
      method: "POST",
      headers,
      body,
    }),
  );
}

describe("POST /api/webhooks/lemonsqueezy signature", () => {
  const body = subscriptionEvent("subscription_updated", "2026-11-20T00:00:00Z");

  test("rejects a missing signature with 401", async () => {
    expect((await deliver(body, null)).status).toBe(401);
  });

  test("rejects a signature of the wrong length with 401", async () => {
    expect((await deliver(body, "abc")).status).toBe(401);
  });

  test("rejects a well-formed but wrong signature with 401", async () => {
    expect((await deliver(body, sign(`${body} `))).status).toBe(401);
  });
});

describe("POST /api/webhooks/lemonsqueezy order_created", () => {
  let restoreContext = () => {};
  let fetchSpy: Mock<typeof fetch>;

  beforeAll(() => {
    // Captures go to the stubbed fetch, never to a real PostHog project.
    Object.assign(env, {
      NEXT_PUBLIC_POSTHOG_HOST: "https://posthog.test",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    });
    restoreContext = stubCloudflareContext();
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}"));
  });

  beforeEach(() => fetchSpy.mockClear());

  afterAll(() => {
    fetchSpy.mockRestore();
    restoreContext();
    Object.assign(env, { NEXT_PUBLIC_POSTHOG_HOST: undefined, NEXT_PUBLIC_POSTHOG_KEY: undefined });
  });

  const orderEvent = (
    attributes: Partial<{ status: string; total: number | string; user_email: string }> = {},
  ) =>
    JSON.stringify({
      meta: {
        event_name: "order_created",
        custom_data: {
          user_id: USER_ID,
          source: "browser-extension",
          utm_source: "browser-extension",
          discount_code: "BFCM20",
        },
      },
      data: {
        id: "5501",
        attributes: {
          status: "paid",
          currency: "USD",
          total: 6400,
          total_usd: 6400,
          test_mode: true,
          first_order_item: { variant_id: PRO_ANNUAL_VARIANT, product_id: 0 },
          ...attributes,
        },
      },
    });

  const captures = () =>
    fetchSpy.mock.calls.map(([, init]) => {
      // SAFETY: captureServerEvent always sends a string JSON body.
      return JSON.parse(init?.body as string) as { event: string; distinct_id: string };
    });

  test("a paid subscription order sends order_completed with the checkout's attribution", async () => {
    expect((await deliver(orderEvent())).status).toBe(200);
    expect(captures()).toEqual([
      expect.objectContaining({
        event: "order_completed",
        distinct_id: USER_ID,
        properties: expect.objectContaining({
          plan: "pro",
          interval: "annual",
          discount_code: "BFCM20",
          source: "browser-extension",
          utm_source: "browser-extension",
          order_id: "5501",
          amount: 64,
          amount_usd: 64,
          currency: "USD",
          test_mode: true,
        }),
      }),
    ]);
  });

  test("an order from an internal account is acknowledged without an event", async () => {
    expect((await deliver(orderEvent({ user_email: "qa@mail.ishortn.ink" }))).status).toBe(200);
    expect(captures()).toEqual([]);
  });

  test("an unpaid order is acknowledged without an event", async () => {
    expect((await deliver(orderEvent({ status: "pending" }))).status).toBe(200);
    expect(captures()).toEqual([]);
  });

  test("an unreadable order payload is still acknowledged", async () => {
    expect((await deliver(orderEvent({ total: "64.00" }))).status).toBe(200);
    expect(captures()).toEqual([]);
  });
});

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("POST /api/webhooks/lemonsqueezy (MySQL)", () => {
  let restoreContext = () => {};

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    // Emails go out through runBackgroundTask, which needs the Cloudflare context.
    restoreContext = stubCloudflareContext();
  });

  async function reset() {
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await db.insert(schema.user).values({ id: USER_ID, email: USER_EMAIL });
  }

  async function seedSubscription(providerUpdatedAt: Date) {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      subscriptionId: SUBSCRIPTION_ID,
      customerId: CUSTOMER_ID,
      status: "active",
      plan: "pro",
      providerUpdatedAt,
    });
  }

  function storedSubscription() {
    return db.query.subscription.findFirst({
      where: eq(schema.subscription.userId, USER_ID),
    });
  }

  beforeEach(reset);

  afterAll(async () => {
    restoreContext();
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  });

  test("applies a valid event and responds 200", async () => {
    const response = await deliver(
      subscriptionEvent("subscription_created", "2026-11-20T00:00:00Z"),
    );
    expect(response.status).toBe(200);

    const row = await storedSubscription();
    expect(row?.subscriptionId).toBe(SUBSCRIPTION_ID);
    expect(row?.customerId).toBe(CUSTOMER_ID);
    expect(row?.status).toBe("active");
  });

  test("responds 500 when the database write fails, so the event is retried", async () => {
    await seedSubscription(new Date("2026-11-19T00:00:00Z"));

    // cardLastFour is varchar(4); strict mode rejects the write.
    const response = await deliver(
      subscriptionEvent("subscription_updated", "2026-11-20T00:00:00Z", undefined, {
        status: "past_due",
        card_last_four: "424242",
      }),
    );
    expect(response.status).toBe(500);
    expect((await storedSubscription())?.status).toBe("active");
  });

  test("acknowledges a duplicate delivery without applying it again", async () => {
    const body = subscriptionEvent("subscription_updated", "2026-11-20T00:00:00Z", undefined, {
      status: "past_due",
    });
    await seedSubscription(new Date("2026-11-19T00:00:00Z"));

    expect((await deliver(body)).status).toBe(200);
    expect((await storedSubscription())?.status).toBe("past_due");

    await db
      .update(schema.subscription)
      .set({ status: "marker" })
      .where(eq(schema.subscription.userId, USER_ID));
    expect((await deliver(body)).status).toBe(200);
    expect((await storedSubscription())?.status).toBe("marker");
  });

  test("stores a pause and its resume date, and clears it on unpause", async () => {
    await seedSubscription(new Date("2026-11-19T00:00:00Z"));

    await deliver(
      subscriptionEvent("subscription_updated", "2026-11-20T00:00:00Z", undefined, {
        status: "paused",
        pause: { mode: "void", resumes_at: "2026-12-20T00:00:00Z" },
      }),
    );
    let row = await storedSubscription();
    expect(row?.status).toBe("paused");
    expect(row?.pausedUntil?.toISOString()).toBe("2026-12-20T00:00:00.000Z");

    await deliver(
      subscriptionEvent("subscription_updated", "2026-11-21T00:00:00Z", undefined, {
        status: "active",
        pause: null,
      }),
    );
    row = await storedSubscription();
    expect(row?.status).toBe("active");
    expect(row?.pausedUntil).toBeNull();
  });

  test("acknowledges a stale event without changing the row", async () => {
    await seedSubscription(new Date("2026-11-20T00:00:00Z"));

    const response = await deliver(
      subscriptionEvent("subscription_expired", "2026-11-19T00:00:00Z"),
    );
    expect(response.status).toBe(200);

    const row = await storedSubscription();
    expect(row?.status).toBe("active");
    expect(row?.plan).toBe("pro");
  });

  test("matches an event without user_id to the user by email", async () => {
    const response = await deliver(
      subscriptionEvent("subscription_created", "2026-11-20T00:00:00Z", null),
    );
    expect(response.status).toBe(200);
    expect((await storedSubscription())?.subscriptionId).toBe(SUBSCRIPTION_ID);
  });

  test("matches an event without user_id to the user by customer_id", async () => {
    await seedSubscription(new Date("2026-11-19T00:00:00Z"));

    const response = await deliver(
      subscriptionEvent(
        "subscription_cancelled",
        "2026-11-20T00:00:00Z",
        {},
        {
          status: "cancelled",
          user_email: "someone-else@example.com",
        },
      ),
    );
    expect(response.status).toBe(200);
    expect((await storedSubscription())?.status).toBe("cancelled");
  });

  test("acknowledges and ignores an event for a subscription Paddle now manages", async () => {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      billingProvider: "paddle",
      providerSubscriptionId: "sub_01route930",
      subscriptionId: 0,
      status: "active",
      plan: "pro",
      providerUpdatedAt: new Date("2026-11-19T00:00:00Z"),
    });

    for (const eventName of ["subscription_created", "subscription_expired"]) {
      const response = await deliver(subscriptionEvent(eventName, "2026-11-20T00:00:00Z"));
      expect(response.status).toBe(200);
    }

    const row = await storedSubscription();
    expect(row?.billingProvider).toBe("paddle");
    expect(row?.providerSubscriptionId).toBe("sub_01route930");
    expect(row?.subscriptionId).toBe(0);
    expect(row?.status).toBe("active");
    expect(row?.plan).toBe("pro");
  });

  test("acknowledges an event that matches no user, without writing", async () => {
    const response = await deliver(
      subscriptionEvent("subscription_created", "2026-11-20T00:00:00Z", null, {
        user_email: "no-such-user-420@example.com",
      }),
    );
    expect(response.status).toBe(200);
    expect(await storedSubscription()).toBeUndefined();
  });
});
