import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { stubCloudflareContext } from "../../../../test/cloudflare-context";
import { applySubscriptionEvent, isOtherLiveSubscription } from "./apply-subscription-event";

import type { SubscriptionEvent, SubscriptionEventKind } from "./apply-subscription-event";
import type { Subscription } from "@/server/db/schema";
import type { sendDuplicateSubscriptionAlert } from "@/server/lib/notifications/discord";

type DuplicateAlert = Parameters<typeof sendDuplicateSubscriptionAlert>[0];

const USER_ID = "apply_subscription_event_test";
const USER_EMAIL = "apply-subscription-event-test@example.com";
const PADDLE_SUBSCRIPTION_ID = "sub_01test930";
const LEMONSQUEEZY_SUBSCRIPTION_ID = 930001;

type PaddleEvent = Extract<SubscriptionEvent, { provider: "paddle" }>;

const log = logger.child({ test: "apply-subscription-event" });

function paddleEvent(
  kind: SubscriptionEventKind,
  updatedAt: string,
  overrides: Partial<PaddleEvent> = {},
): PaddleEvent {
  return {
    provider: "paddle",
    kind,
    userId: USER_ID,
    providerSubscriptionId: PADDLE_SUBSCRIPTION_ID,
    providerCustomerId: "ctm_01test930",
    providerPriceId: "pri_01pro",
    status: "active",
    plan: "pro",
    billingInterval: "monthly",
    renewsAt: new Date("2026-12-27T00:00:00Z"),
    endsAt: null,
    pausedUntil: null,
    createdAt: new Date("2026-11-27T00:00:00Z"),
    cardBrand: "visa",
    cardLastFour: "4242",
    providerUpdatedAt: new Date(updatedAt),
    ...overrides,
  };
}

describe("isOtherLiveSubscription", () => {
  // SAFETY: the check reads only billingProvider, providerSubscriptionId and status.
  const row = (fields: Partial<Subscription>) =>
    ({
      billingProvider: "paddle",
      providerSubscriptionId: PADDLE_SUBSCRIPTION_ID,
      status: "active",
      ...fields,
    }) as Subscription;
  const second = paddleEvent("created", "2026-11-28T00:00:00Z", {
    providerSubscriptionId: "sub_01second",
  });

  test.each(["active", "on_trial", "past_due", "paused"])(
    "a different %s Paddle subscription is live",
    (status) => {
      expect(isOtherLiveSubscription(row({ status }), second)).toBe(true);
    },
  );

  test.each(["cancelled", "expired"])("a %s Paddle subscription can be replaced", (status) => {
    expect(isOtherLiveSubscription(row({ status }), second)).toBe(false);
  });

  test("the same subscription, no row, or a Lemon Squeezy row is not a second one", () => {
    expect(isOtherLiveSubscription(row({}), paddleEvent("created", "2026-11-28T00:00:00Z"))).toBe(
      false,
    );
    expect(isOtherLiveSubscription(null, second)).toBe(false);
    expect(
      isOtherLiveSubscription(
        row({ billingProvider: "lemonsqueezy", providerSubscriptionId: null }),
        second,
      ),
    ).toBe(false);
  });
});

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("applySubscriptionEvent with Paddle (MySQL)", () => {
  let restoreContext = () => {};

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    // Emails go out through runBackgroundTask, which needs the Cloudflare context.
    restoreContext = stubCloudflareContext();
  });

  async function reset() {
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await db.insert(schema.user).values({ id: USER_ID, email: USER_EMAIL });
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

  test("created writes a Paddle row keyed on providerSubscriptionId", async () => {
    const outcome = await applySubscriptionEvent(paddleEvent("created", "2026-11-27T00:00:00Z"), {
      log,
    });
    expect(outcome.result).toBe("applied");

    const row = await storedSubscription();
    expect(row?.billingProvider).toBe("paddle");
    expect(row?.providerSubscriptionId).toBe(PADDLE_SUBSCRIPTION_ID);
    expect(row?.providerCustomerId).toBe("ctm_01test930");
    expect(row?.providerPriceId).toBe("pri_01pro");
    expect(row?.subscriptionId).toBe(0);
    expect(row?.customerId).toBe(0);
    expect(row?.status).toBe("active");
    expect(row?.plan).toBe("pro");
  });

  test("updated, cancelled and expired apply in order to the Paddle row", async () => {
    await applySubscriptionEvent(paddleEvent("created", "2026-11-27T00:00:00Z"), { log });

    const updated = await applySubscriptionEvent(
      paddleEvent("updated", "2026-11-28T00:00:00Z", {
        plan: "ultra",
        providerPriceId: "pri_01ultra",
        billingInterval: "annual",
      }),
      { log },
    );
    expect(updated.result).toBe("applied");
    let row = await storedSubscription();
    expect(row?.plan).toBe("ultra");
    expect(row?.providerPriceId).toBe("pri_01ultra");
    expect(row?.billingInterval).toBe("annual");

    const cancelled = await applySubscriptionEvent(
      paddleEvent("cancelled", "2026-11-29T00:00:00Z", {
        status: "cancelled",
        plan: "ultra",
        endsAt: new Date("2027-11-28T00:00:00Z"),
      }),
      { log },
    );
    expect(cancelled.result).toBe("applied");
    row = await storedSubscription();
    expect(row?.status).toBe("cancelled");
    expect(row?.plan).toBe("ultra");
    expect(row?.endsAt?.toISOString()).toBe("2027-11-28T00:00:00.000Z");

    const expired = await applySubscriptionEvent(
      paddleEvent("expired", "2026-11-30T00:00:00Z", { status: "expired" }),
      { log },
    );
    expect(expired.result).toBe("applied");
    expect(expired.previous?.status).toBe("cancelled");
    row = await storedSubscription();
    expect(row?.status).toBe("expired");
    expect(row?.plan).toBe("free");
  });

  test("ignores a stale Paddle event", async () => {
    await applySubscriptionEvent(paddleEvent("created", "2026-11-27T00:00:00Z"), { log });

    const outcome = await applySubscriptionEvent(
      paddleEvent("expired", "2026-11-26T00:00:00Z", { status: "expired" }),
      { log },
    );
    expect(outcome.result).toBe("stale");
    expect((await storedSubscription())?.plan).toBe("pro");
  });

  test("an update that arrives before created asks for a redelivery", async () => {
    const createdAt = new Date();
    const early = await applySubscriptionEvent(
      paddleEvent("updated", "2026-11-27T00:00:05Z", { createdAt }),
      { log },
    );
    expect(early.result).toBe("not_created_yet");
    expect(await storedSubscription()).toBeUndefined();

    await applySubscriptionEvent(paddleEvent("created", "2026-11-27T00:00:00Z", { createdAt }), {
      log,
    });
    const redelivered = await applySubscriptionEvent(
      paddleEvent("updated", "2026-11-27T00:00:05Z", { createdAt, status: "past_due" }),
      { log },
    );
    expect(redelivered.result).toBe("applied");
    expect((await storedSubscription())?.status).toBe("past_due");
  });

  test("an update for a new subscription waits for created when an older row exists", async () => {
    await applySubscriptionEvent(paddleEvent("created", "2026-11-01T00:00:00Z"), { log });

    const early = await applySubscriptionEvent(
      paddleEvent("updated", "2026-11-27T00:00:05Z", {
        providerSubscriptionId: "sub_01test930new",
        createdAt: new Date(),
      }),
      { log },
    );
    expect(early.result).toBe("not_created_yet");
    expect((await storedSubscription())?.providerSubscriptionId).toBe(PADDLE_SUBSCRIPTION_ID);
  });

  test("acknowledges an event after the account and its row were deleted", async () => {
    await applySubscriptionEvent(paddleEvent("created", "2026-11-27T00:00:00Z"), { log });
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));

    const outcome = await applySubscriptionEvent(
      paddleEvent("expired", "2026-11-27T00:00:05Z", { status: "expired", createdAt: new Date() }),
      { log },
    );
    expect(outcome.result).toBe("no_row_matched");
    expect(await storedSubscription()).toBeUndefined();
  });

  test("acknowledges an event with no row once the purchase is old", async () => {
    const outcome = await applySubscriptionEvent(
      paddleEvent("expired", "2026-11-27T00:00:05Z", {
        status: "expired",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      }),
      { log },
    );
    expect(outcome.result).toBe("no_row_matched");
  });

  test("an event repeating the stored updated_at is stale", async () => {
    await applySubscriptionEvent(paddleEvent("created", "2026-11-27T00:00:00Z"), { log });
    const activated = await applySubscriptionEvent(paddleEvent("updated", "2026-11-27T00:00:00Z"), {
      log,
    });
    expect(activated.result).toBe("stale");
  });

  test("an update naming another Paddle subscription matches no row", async () => {
    await applySubscriptionEvent(paddleEvent("created", "2026-11-27T00:00:00Z"), { log });

    const outcome = await applySubscriptionEvent(
      paddleEvent("updated", "2026-11-28T00:00:00Z", {
        providerSubscriptionId: "sub_01other",
        status: "past_due",
      }),
      { log },
    );
    expect(outcome.result).toBe("no_row_matched");
    expect((await storedSubscription())?.status).toBe("active");
  });

  test("created replaces a Lemon Squeezy row, even one that still grants access", async () => {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      subscriptionId: LEMONSQUEEZY_SUBSCRIPTION_ID,
      customerId: 930002,
      status: "active",
      plan: "pro",
      // Newer than the Paddle event: another provider's marker doesn't order it.
      providerUpdatedAt: new Date("2026-11-28T00:00:00Z"),
    });

    const outcome = await applySubscriptionEvent(
      paddleEvent("created", "2026-11-27T00:00:00Z", { plan: "ultra" }),
      { log },
    );
    expect(outcome.result).toBe("applied");
    expect(outcome.previous?.billingProvider).toBe("lemonsqueezy");

    const row = await storedSubscription();
    expect(row?.billingProvider).toBe("paddle");
    expect(row?.providerSubscriptionId).toBe(PADDLE_SUBSCRIPTION_ID);
    expect(row?.subscriptionId).toBe(0);
    expect(row?.customerId).toBe(0);
    expect(row?.plan).toBe("ultra");
  });

  describe("a second live Paddle subscription", () => {
    let alerts: DuplicateAlert[];
    const alertDuplicateSubscription = async (alert: DuplicateAlert) => {
      alerts.push(alert);
      return true;
    };
    const secondSubscription = { providerSubscriptionId: "sub_01second", plan: "ultra" as const };

    beforeEach(async () => {
      alerts = [];
      await applySubscriptionEvent(paddleEvent("created", "2026-11-27T00:00:00Z"), { log });
    });

    test("created keeps the original row and alerts with both ids", async () => {
      const outcome = await applySubscriptionEvent(
        paddleEvent("created", "2026-11-28T00:00:00Z", secondSubscription),
        { log, alertDuplicateSubscription },
      );

      expect(outcome.result).toBe("duplicate_subscription");
      const row = await storedSubscription();
      expect(row?.providerSubscriptionId).toBe(PADDLE_SUBSCRIPTION_ID);
      expect(row?.plan).toBe("pro");
      expect(row?.providerUpdatedAt?.toISOString()).toBe("2026-11-27T00:00:00.000Z");
      // The alert goes out in the background.
      await Bun.sleep(0);
      expect(alerts).toEqual([
        {
          userId: USER_ID,
          storedSubscriptionId: PADDLE_SUBSCRIPTION_ID,
          storedStatus: "active",
          newSubscriptionId: "sub_01second",
          eventType: "created",
        },
      ]);
    });

    test("activated for the second subscription alerts and leaves the row", async () => {
      const outcome = await applySubscriptionEvent(
        paddleEvent("updated", "2026-11-28T00:00:00Z", secondSubscription),
        { log, activation: true, alertDuplicateSubscription },
      );

      expect(outcome.result).toBe("duplicate_subscription");
      expect((await storedSubscription())?.providerSubscriptionId).toBe(PADDLE_SUBSCRIPTION_ID);
      await Bun.sleep(0);
      expect(alerts.map((alert) => alert.eventType)).toEqual(["activated"]);
    });

    test("a new subscription after the first expired replaces the row", async () => {
      await applySubscriptionEvent(
        paddleEvent("expired", "2026-11-28T00:00:00Z", { status: "expired" }),
        { log },
      );

      const outcome = await applySubscriptionEvent(
        paddleEvent("created", "2026-11-29T00:00:00Z", secondSubscription),
        { log, alertDuplicateSubscription },
      );

      expect(outcome.result).toBe("applied");
      expect((await storedSubscription())?.providerSubscriptionId).toBe("sub_01second");
      expect(alerts).toEqual([]);
    });
  });

  test("a Paddle update leaves a Lemon Squeezy row alone", async () => {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      subscriptionId: LEMONSQUEEZY_SUBSCRIPTION_ID,
      status: "active",
      plan: "pro",
      providerUpdatedAt: new Date("2026-11-20T00:00:00Z"),
    });

    const outcome = await applySubscriptionEvent(
      paddleEvent("expired", "2026-11-27T00:00:00Z", { status: "expired" }),
      { log },
    );
    expect(outcome.result).toBe("no_row_matched");
    const row = await storedSubscription();
    expect(row?.billingProvider).toBe("lemonsqueezy");
    expect(row?.plan).toBe("pro");
  });
});
