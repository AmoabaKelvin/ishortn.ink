import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";
import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { pauseResumesAt } from "@/lib/billing/plans";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { stubCloudflareContext } from "../../../../../test/cloudflare-context";
import { lemonsqueezyRouter } from "./lemonsqueezy.procedure";

import type { TRPCContext } from "../../trpc";
import type { Mock } from "bun:test";

// The cancel flow against a real MySQL, with Lemon Squeezy answered by a stubbed fetch. Set
// TEST_DATABASE_URL to run it; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const USER_ID = "ls_cancel_flow_test";
const SUBSCRIPTION_ID = 943001;
const PRO_MONTHLY_VARIANT = 1811616;
const PRO_ANNUAL_VARIANT = 1809620;
const DAY = 24 * 60 * 60 * 1000;

type PatchBody = {
  data: {
    attributes: { pause?: { mode: string; resumes_at: string } | null; cancelled?: boolean };
  };
};

describe.skipIf(!testDatabaseUrl)("lemonsqueezy cancel flow (MySQL)", () => {
  let restoreContext: () => void;
  let fetchSpy: Mock<typeof fetch>;
  let requests: { method: string; url: string; body: PatchBody | null }[];
  let updatedAt = Date.now();

  // Answers every provider call with the subscription in `status`, echoing the requested pause.
  function provider(status: string) {
    fetchSpy.mockImplementation(async (input, init) => {
      // SAFETY: the Lemon Squeezy client always passes a string URL and a string JSON body.
      const body = init?.body ? (JSON.parse(init.body as string) as PatchBody) : null;
      requests.push({ method: init?.method ?? "GET", url: String(input), body });
      const pause = body?.data.attributes.pause ?? null;
      updatedAt += 1000;
      return Response.json({
        data: {
          id: String(SUBSCRIPTION_ID),
          attributes: {
            status,
            pause,
            variant_id: PRO_MONTHLY_VARIANT,
            product_id: 0,
            renews_at: new Date(Date.now() + 20 * DAY).toISOString(),
            ends_at: status === "cancelled" ? new Date(Date.now() + 20 * DAY).toISOString() : null,
            updated_at: new Date(updatedAt).toISOString(),
          },
        },
      });
    });
  }

  function caller() {
    // SAFETY: the procedures under test read only ctx.auth.userId from auth.
    const auth = { userId: USER_ID } as TRPCContext["auth"];
    return lemonsqueezyRouter.createCaller({ db, auth, headers: new Headers() });
  }

  async function seed(subscription: Partial<typeof schema.subscription.$inferInsert> = {}) {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      subscriptionId: SUBSCRIPTION_ID,
      customerId: 1,
      status: "active",
      plan: "pro",
      variantId: PRO_MONTHLY_VARIANT,
      renewsAt: new Date(Date.now() + 20 * DAY),
      ...subscription,
    });
  }

  const stored = () =>
    db.query.subscription.findFirst({ where: eq(schema.subscription.userId, USER_ID) });
  const cancellations = () =>
    db.query.subscriptionCancellation.findMany({
      where: eq(schema.subscriptionCancellation.userId, USER_ID),
    });

  async function cleanup() {
    await db
      .delete(schema.subscriptionCancellation)
      .where(eq(schema.subscriptionCancellation.userId, USER_ID));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    Object.assign(env, {
      LEMONSQUEEZY_API_KEY: "test-key",
      LEMONSQUEEZY_STORE_ID: "1",
      LEMONSQUEEZY_WEBHOOK_SECRET: "test-secret",
      DISCORD_WEBHOOK_URL: undefined,
    });
    // Also set directly: another test file replaces configureLemonSqueezy with a no-op for the run.
    lemonSqueezySetup({ apiKey: "test-key" });
    restoreContext = stubCloudflareContext();
    fetchSpy = spyOn(globalThis, "fetch");
  });

  beforeEach(async () => {
    requests = [];
    fetchSpy.mockReset();
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID, email: `${USER_ID}@example.com` });
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    restoreContext();
    await cleanup();
  });

  test.each([1, 2, 3])("a %p month pause voids billing until then", async (months) => {
    await seed();
    provider("paused");

    const before = Date.now();
    await caller().pauseSubscription({ months, reason: "temporary_pause", feedback: "Back soon" });
    const after = Date.now();

    const patch = requests.find((request) => request.method === "PATCH");
    expect(patch?.url).toContain(`/v1/subscriptions/${SUBSCRIPTION_ID}`);
    const pause = patch?.body?.data.attributes.pause;
    expect(pause?.mode).toBe("void");
    const resumesAt = new Date(pause?.resumes_at ?? 0).getTime();
    expect(resumesAt).toBeGreaterThanOrEqual(pauseResumesAt(months, new Date(before)).getTime());
    expect(resumesAt).toBeLessThanOrEqual(pauseResumesAt(months, new Date(after)).getTime());

    const row = await stored();
    expect(row?.status).toBe("paused");
    // MySQL datetime keeps whole seconds.
    expect(Math.abs((row?.pausedUntil?.getTime() ?? 0) - resumesAt)).toBeLessThan(1000);

    const records = await cancellations();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      subscriptionId: SUBSCRIPTION_ID,
      fromPlan: "pro",
      toPlan: "free",
      billingInterval: "monthly",
      variantId: PRO_MONTHLY_VARIANT,
      reason: "temporary_pause",
      feedback: "Back soon",
      offerShown: "pause",
      outcome: "paused",
      pauseMonths: months,
    });
  });

  test.each([
    ["past_due", {}],
    ["on_trial", {}],
    ["cancelled", { endsAt: new Date(Date.now() + 5 * DAY) }],
    ["paused", {}],
    ["active", { variantId: PRO_ANNUAL_VARIANT }],
  ] as const)("a %s subscription can't be paused", async (status, overrides) => {
    await seed({ status, ...overrides });
    provider("paused");

    expect(caller().pauseSubscription({ months: 1, reason: "other" })).rejects.toThrow(
      "Only an active monthly subscription can be paused.",
    );
    expect(requests).toHaveLength(0);
    expect(await cancellations()).toHaveLength(0);
  });

  test("a month count outside 1-3 is rejected", async () => {
    await seed();
    expect(caller().pauseSubscription({ months: 4, reason: "other" })).rejects.toThrow();
  });

  test("cancelling records the reason with the pause offer shown", async () => {
    await seed();
    provider("cancelled");

    const result = await caller().downgradeWithFeedback({
      targetPlan: "free",
      reason: "too_expensive",
      additionalFeedback: "Costs too much",
    });
    expect(result.status).toBe("cancelled");
    expect(requests.find((request) => request.method === "DELETE")).toBeDefined();

    const records = await cancellations();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      fromPlan: "pro",
      toPlan: "free",
      reason: "too_expensive",
      feedback: "Costs too much",
      offerShown: "pause",
      outcome: "cancelled",
      pauseMonths: null,
    });
  });

  test("cancelling an annual subscription records that no pause was offered", async () => {
    await seed({ variantId: PRO_ANNUAL_VARIANT, billingInterval: "annual" });
    provider("cancelled");

    await caller().downgradeWithFeedback({ targetPlan: "free", reason: "other" });

    const records = await cancellations();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      billingInterval: "annual",
      offerShown: "none",
      outcome: "cancelled",
      feedback: null,
    });
  });

  test("resuming a paused subscription unpauses it", async () => {
    await seed({ status: "paused", pausedUntil: new Date(Date.now() + 30 * DAY) });
    provider("active");

    await caller().resumeSubscription();

    const patch = requests.find((request) => request.method === "PATCH");
    expect(patch?.body?.data.attributes).toEqual({ pause: null });
    const row = await stored();
    expect(row?.status).toBe("active");
    expect(row?.pausedUntil).toBeNull();
  });

  test("resuming a cancelled subscription uncancels it", async () => {
    await seed({ status: "cancelled", endsAt: new Date(Date.now() + 5 * DAY) });
    provider("active");

    await caller().resumeSubscription();

    const patch = requests.find((request) => request.method === "PATCH");
    expect(patch?.body?.data.attributes).toEqual({ cancelled: false });
  });

  test("a paused subscriber can't start a second subscription", async () => {
    await seed({ status: "paused" });
    provider("active");

    expect(caller().createCheckoutOrUpdate({ plan: "pro" })).rejects.toThrow(
      "Your subscription is paused. Resume it before changing plans.",
    );
    expect(requests).toHaveLength(0);
  });
});
