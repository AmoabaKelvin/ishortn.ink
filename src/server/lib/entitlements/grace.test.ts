import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { eq } from "drizzle-orm";
import { createElement } from "react";

import PlanGraceEmail from "@/emails/plan-grace";
import { env } from "@/env.mjs";
import { dueGraceEmail, effectivePlan, EMPTY_USAGE, teamAccess } from "@/lib/billing/entitlements";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import {
  accountGraceEmail,
  overPlanGrace,
  paymentUpdateEmailAllowed,
  syncProviderEndedSubscriptions,
  teamGraceEmail,
} from "./grace";
import {
  lookupProviderSubscription,
  ProviderNotConfiguredError,
  ProviderSubscriptionNotFoundError,
} from "./provider-status";

import type { ProviderSubscriptionRef, ProviderSubscriptionState } from "./provider-status";
import type { PlanUsage } from "@/lib/billing/entitlements";
import type { Plan } from "@/lib/billing/plans";
import type { PaddleSubscription } from "@/lib/paddle/client";
import type { Subscription } from "@/server/db/schema";

const NOW = new Date("2026-11-20T12:00:00Z");
const ENDS_AT = new Date("2026-11-27T12:00:00Z");
const ULTRA_VARIANT = 1108002;

const PRO_VARIANT = 1811616;

function ownerSubscription(status: string, plan: "pro" | "ultra" = "ultra"): Subscription {
  // SAFETY: the grace emails read only the status, plan and end date fields of the subscription.
  return {
    status,
    plan,
    variantId: plan === "ultra" ? ULTRA_VARIANT : PRO_VARIANT,
    productId: 0,
    endsAt: null,
  } as Subscription;
}

const email = (sub: Subscription | null, kind: "started" | "reminder" = "started") =>
  teamGraceEmail({
    teamName: "Acme",
    ownerSubscription: sub,
    endsAt: ENDS_AT,
    kind,
    now: NOW,
  });

describe("teamGraceEmail", () => {
  test.each(["past_due", "unpaid"])(
    "a %s Ultra owner gets the update-payment-method button",
    async (status) => {
      for (const kind of ["started", "reminder"] as const) {
        const { props } = email(ownerSubscription(status), kind);
        expect(props.updatePaymentUrl).toContain(
          "/dashboard/settings/billing/update-payment?source=email",
        );
        const html = await render(createElement(PlanGraceEmail, props));
        expect(html).toContain("Update payment method");
        expect(html).toContain(`href="${props.updatePaymentUrl}"`);
        expect(html).not.toContain("Upgrade to Ultra");
      }
      expect(email(ownerSubscription(status)).subject).toBe(
        "Your iShortn Ultra payment didn't go through",
      );
    },
  );

  test("a cancelled owner keeps the pricing link", async () => {
    const { subject, props } = email(ownerSubscription("cancelled"));
    expect(props.updatePaymentUrl).toBeUndefined();
    expect(subject).toBe("Acme needs Ultra to stay editable after November 27, 2026");
    const html = await render(createElement(PlanGraceEmail, props));
    expect(html).toContain("Upgrade to Ultra");
    expect(html).not.toContain("Update payment method");
  });

  test("an owner with no subscription keeps the pricing link", () => {
    expect(email(null).props.updatePaymentUrl).toBeUndefined();
  });
});

const accountEmail = (
  sub: Subscription | null,
  gracePlan: Plan,
  reason: "lapsed" | "over_plan",
  usage: PlanUsage = { ...EMPTY_USAGE, customDomains: 3 },
) =>
  accountGraceEmail({
    subscription: sub,
    usage,
    gracePlan,
    reason,
    endsAt: ENDS_AT,
    kind: "started",
    now: NOW,
  });

describe("accountGraceEmail", () => {
  test("the day-0 email for an unpaid subscription asks for a payment method update", async () => {
    const { subject, props } = accountEmail(ownerSubscription("unpaid"), "ultra", "lapsed")!;
    expect(subject).toBe("Your iShortn Ultra payment didn't go through");
    expect(props.updatePaymentUrl).toContain(
      "/dashboard/settings/billing/update-payment?source=email",
    );
    const html = await render(createElement(PlanGraceEmail, props));
    expect(html).toContain("Update payment method");
    expect(html).toContain(`href="${props.updatePaymentUrl}"`);
    expect(html).not.toContain(`href="${props.upgradeUrl}"`);
  });

  test("an over-plan grace the unpaid subscription covers asks for a payment method update", () => {
    const { subject, props } = accountEmail(
      ownerSubscription("unpaid", "pro"),
      "pro",
      "over_plan",
    )!;
    expect(subject).toBe("Your iShortn Pro payment didn't go through");
    expect(props.updatePaymentUrl).toBeDefined();
  });

  test("an over-plan grace above the unpaid subscription's plan keeps the pricing link", () => {
    const { subject, props } = accountEmail(
      ownerSubscription("unpaid", "pro"),
      "ultra",
      "over_plan",
    )!;
    expect(subject).toBe("Keep your Ultra features after November 27, 2026");
    expect(props.updatePaymentUrl).toBeUndefined();
    expect(props.upgradeUrl).toBe("https://ishortn.ink/e-grace-ultra");
  });

  test("an over-plan grace with nothing it covers left produces no email", () => {
    expect(accountEmail(null, "pro", "over_plan", EMPTY_USAGE)).toBeNull();
    // Creation caps alone aren't listed, so nothing is left either.
    expect(accountEmail(null, "pro", "over_plan", { ...EMPTY_USAGE, qrCodes: 12 })).toBeNull();
  });

  test("an over-plan email lists only features the grace covers", () => {
    const email = accountEmail(null, "pro", "over_plan", {
      ...EMPTY_USAGE,
      passwordLinks: 2,
      qrCodes: 12,
      folders: 3,
    });
    expect(email?.props.items).toEqual(["Password-protected links: 2 (not included in Free)"]);
  });

  test("a lapse with nothing over the plan still gets its email", () => {
    const email = accountEmail(null, "pro", "lapsed", EMPTY_USAGE);
    expect(email?.props.items.length).toBeGreaterThan(0);
    expect(email?.props.itemsAreFreePlan).toBe(true);
  });

  test("a lapse with features over the plan lists them, not the Free plan summary", () => {
    expect(accountEmail(null, "pro", "lapsed")?.props.itemsAreFreePlan).toBe(false);
  });
});

describe("overPlanGrace", () => {
  test.each([
    ["12 QR codes", { qrCodes: 12 }],
    ["6 link blocks on a bio page", { maxLinkBlocksPerBioPage: 6 }],
    ["3 folders", { folders: 3 }],
    [
      "only creation caps",
      {
        bioPages: 4,
        bioPagesWithPaidOptions: 1,
        activeCampaigns: 3,
        maxMilestonesPerLink: 9,
        verifiedClickLinks: 2,
        cloakedLinks: 1,
      },
    ],
  ] satisfies [string, Partial<PlanUsage>][])("a Free account with %s gets none", (_, usage) => {
    expect(overPlanGrace({ ...EMPTY_USAGE, ...usage }, "free", NOW)).toBeNull();
  });

  test.each([
    ["a password-protected link", { passwordLinks: 1 }, "pro"],
    ["a custom domain", { customDomains: 1 }, "pro"],
    ["a scheduled link", { scheduledLinks: 1 }, "pro"],
    ["a link with UTM parameters", { utmLinks: 1 }, "pro"],
    ["targeting rules", { maxTargetingRulesPerLink: 2 }, "pro"],
  ] satisfies [string, Partial<PlanUsage>, Plan][])(
    "a Free account with %s gets one",
    (_, usage, plan) => {
      expect(overPlanGrace({ ...EMPTY_USAGE, ...usage, qrCodes: 12 }, "free", NOW)).toEqual({
        plan,
        endsAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
        reason: "over_plan",
      });
    },
  );
});

const providerState = (status: string): ProviderSubscriptionState => ({
  status,
  endsAt: new Date("2026-05-14T00:00:00Z"),
  updatedAt: new Date("2026-05-14T00:00:00Z"),
});

describe("paymentUpdateEmailAllowed", () => {
  const unpaid = { ...ownerSubscription("unpaid"), userId: "u1", subscriptionId: 42 };

  function check(provider: ProviderSubscriptionState | Error) {
    const synced: ProviderSubscriptionState[] = [];
    const looked: ProviderSubscriptionRef[] = [];
    return {
      synced,
      looked,
      check: {
        lookup: async (sub: ProviderSubscriptionRef) => {
          looked.push(sub);
          if (provider instanceof Error) throw provider;
          return provider;
        },
        sync: async (_: Subscription, state: ProviderSubscriptionState) => {
          synced.push(state);
          return true;
        },
      },
    };
  }

  test("skips the card-update email for a subscription the provider has expired", async () => {
    const { check: expired, synced } = check(providerState("expired"));
    expect(await paymentUpdateEmailAllowed(unpaid, NOW, expired)).toBe(false);
    expect(synced.map((state) => state.status)).toEqual(["expired"]);
  });

  test("skips it for a subscription the provider has cancelled", async () => {
    const { check: cancelled, synced } = check(providerState("cancelled"));
    expect(await paymentUpdateEmailAllowed(unpaid, NOW, cancelled)).toBe(false);
    expect(synced).toHaveLength(1);
  });

  test.each(["past_due", "unpaid"])("sends it while the provider reports %s", async (status) => {
    const { check: failing, synced } = check(providerState(status));
    expect(await paymentUpdateEmailAllowed(unpaid, NOW, failing)).toBe(true);
    expect(synced).toHaveLength(0);
  });

  test("defers it when the provider can't be reached", async () => {
    const { check: down } = check(new Error("provider down"));
    expect(await paymentUpdateEmailAllowed(unpaid, NOW, down)).toBe(false);
  });

  test("sends it for a row without a subscription id, which can't be checked", async () => {
    const { check: unused } = check(new Error("not called"));
    expect(await paymentUpdateEmailAllowed({ ...unpaid, subscriptionId: 0 }, NOW, unused)).toBe(
      true,
    );
  });

  const paddle = {
    ...unpaid,
    subscriptionId: 0,
    billingProvider: "paddle",
    providerSubscriptionId: "sub_01h8",
  };

  test("checks a Paddle row with the lookup too", async () => {
    const { check: expired, looked, synced } = check(providerState("expired"));
    expect(await paymentUpdateEmailAllowed(paddle, NOW, expired)).toBe(false);
    expect(looked[0]?.providerSubscriptionId).toBe("sub_01h8");
    expect(synced).toHaveLength(1);
  });

  test("sends it for a Paddle row while Paddle isn't configured", async () => {
    const { check: unconfigured } = check(new ProviderNotConfiguredError("no Paddle"));
    expect(await paymentUpdateEmailAllowed(paddle, NOW, unconfigured)).toBe(true);
  });
});

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("syncProviderEndedSubscriptions: failed payments (MySQL)", () => {
  const USERS = ["grace_sync_expired", "grace_sync_unpaid", "grace_sync_active"] as const;
  const SUBSCRIPTION_IDS = {
    grace_sync_expired: 962001,
    grace_sync_unpaid: 962002,
    grace_sync_active: 962003,
  };
  const LAPSE_ENDED = new Date("2026-03-20T00:00:00Z");

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function clean() {
    for (const id of USERS) {
      await db.delete(schema.subscription).where(eq(schema.subscription.userId, id));
      await db.delete(schema.user).where(eq(schema.user.id, id));
    }
  }

  beforeEach(async () => {
    await clean();
    for (const id of USERS) {
      // A lapse grace that already ran out, as the failed payment left it.
      await db.insert(schema.user).values({
        id,
        email: `${id}@example.com`,
        planGracePlan: "pro",
        planGraceEndsAt: LAPSE_ENDED,
        planGraceReason: "lapsed",
        planGraceEmailStage: 3,
      });
      await db.insert(schema.subscription).values({
        userId: id,
        subscriptionId: SUBSCRIPTION_IDS[id],
        status: id === "grace_sync_active" ? "active" : "unpaid",
        plan: "pro",
        variantId: PRO_VARIANT,
        providerUpdatedAt: new Date("2026-03-13T00:00:00Z"),
      });
    }
  });

  afterAll(clean);

  const stored = (id: string) =>
    db.query.subscription.findFirst({ where: eq(schema.subscription.userId, id) });

  test("syncs only the rows the provider has ended", async () => {
    const looked: number[] = [];
    const synced = await syncProviderEndedSubscriptions(NOW, async ({ subscriptionId }) => {
      looked.push(subscriptionId ?? 0);
      return providerState(
        subscriptionId === SUBSCRIPTION_IDS.grace_sync_expired ? "expired" : "unpaid",
      );
    });
    expect(synced).toBe(1);
    expect(looked).toContain(SUBSCRIPTION_IDS.grace_sync_active);

    const expired = await stored("grace_sync_expired");
    expect(expired?.status).toBe("expired");
    expect(expired?.plan).toBe("free");
    expect(expired?.variantId).toBe(0);
    expect(expired?.endsAt).toEqual(new Date("2026-05-14T00:00:00Z"));
    expect(expired?.providerUpdatedAt).toEqual(new Date("2026-05-14T00:00:00Z"));
    expect((await stored("grace_sync_unpaid"))?.status).toBe("unpaid");
    expect((await stored("grace_sync_active"))?.status).toBe("active");

    // The passed lapse grace is kept, so no second one starts and no email goes out.
    const account = await db.query.user.findFirst({
      where: eq(schema.user.id, "grace_sync_expired"),
    });
    expect(account?.planGraceEndsAt).toEqual(LAPSE_ENDED);

    // A later run checks only the rows still unpaid or active.
    expect(await syncProviderEndedSubscriptions(NOW, async () => providerState("expired"))).toBe(2);
  });
});

describe.skipIf(!testDatabaseUrl)("syncProviderEndedSubscriptions: active rows (MySQL)", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
  const ROWS = {
    active_stale: { subscriptionId: 963001, status: "expired", endsAt: daysAgo(90) },
    active_recent: { subscriptionId: 963002, status: "expired", endsAt: daysAgo(5) },
    active_missing: { subscriptionId: 963003, status: null, endsAt: null },
    active_cancelled_past: { subscriptionId: 963004, status: "cancelled", endsAt: daysAgo(3) },
    active_cancelled_future: {
      subscriptionId: 963005,
      status: "cancelled",
      endsAt: new Date(NOW.getTime() + 10 * DAY_MS),
    },
  };
  type RowId = keyof typeof ROWS;
  // SAFETY: Object.keys of a literal object returns exactly its keys.
  const USERS = Object.keys(ROWS) as RowId[];
  const TEAM_SLUG = "grace-sync-stale-team";
  const bySubscriptionId = new Map(Object.values(ROWS).map((row) => [row.subscriptionId, row]));

  async function lookup({ subscriptionId }: ProviderSubscriptionRef) {
    const row = bySubscriptionId.get(subscriptionId ?? 0);
    if (!row?.status) throw new ProviderSubscriptionNotFoundError("not found");
    const state: ProviderSubscriptionState = {
      status: row.status,
      endsAt: row.endsAt,
      updatedAt: row.endsAt,
    };
    return state;
  }

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function clean() {
    await db.delete(schema.team).where(eq(schema.team.slug, TEAM_SLUG));
    for (const id of USERS) {
      await db.delete(schema.subscription).where(eq(schema.subscription.userId, id));
      await db.delete(schema.user).where(eq(schema.user.id, id));
    }
  }

  beforeEach(async () => {
    await clean();
    for (const id of USERS) {
      await db.insert(schema.user).values({ id, email: `${id}@example.com` });
      await db.insert(schema.subscription).values({
        userId: id,
        subscriptionId: ROWS[id].subscriptionId,
        status: "active",
        plan: "ultra",
        variantId: ULTRA_VARIANT,
        providerUpdatedAt: daysAgo(400),
      });
    }
    await db
      .insert(schema.team)
      .values({ name: "Stale team", slug: TEAM_SLUG, ownerId: "active_stale" });
  });

  afterAll(clean);

  const load = async (id: RowId) => {
    const account = await db.query.user.findFirst({
      where: eq(schema.user.id, id),
      with: { subscriptions: true },
    });
    if (!account) throw new Error(`missing ${id}`);
    return account;
  };
  const nextEmail = (account: Awaited<ReturnType<typeof load>>) =>
    account.planGraceEndsAt
      ? dueGraceEmail({
          reason: account.planGraceReason ?? "lapsed",
          endsAt: account.planGraceEndsAt,
          stage: account.planGraceEmailStage ?? 0,
          now: NOW,
        })
      : null;

  test("syncs active rows the provider ended, emailing only recent lapses", async () => {
    expect(await syncProviderEndedSubscriptions(NOW, lookup)).toBe(3);

    // Ended 90 days ago: expired and on Free at once, with nothing left to email.
    const stale = await load("active_stale");
    expect(stale.subscriptions?.status).toBe("expired");
    expect(stale.subscriptions?.plan).toBe("free");
    expect(stale.subscriptions?.endsAt).toEqual(ROWS.active_stale.endsAt);
    expect(effectivePlan(stale.subscriptions, stale, NOW)).toBe("free");
    expect(stale.planGraceEndsAt).toEqual(daysAgo(83));
    expect(nextEmail(stale)).toBeNull();
    const staleTeam = await db.query.team.findFirst({ where: eq(schema.team.slug, TEAM_SLUG) });
    expect(teamAccess("free", staleTeam?.ownerPlanGraceEndsAt ?? null, NOW).readOnly).toBe(true);
    expect(
      dueGraceEmail({
        reason: "over_plan",
        endsAt: staleTeam?.ownerPlanGraceEndsAt ?? NOW,
        stage: staleTeam?.ownerPlanGraceEmailStage ?? 0,
        now: NOW,
      }),
    ).toBeNull();

    // Ended 5 days ago: the lapse path, a grace period at the old plan and its first email.
    const recent = await load("active_recent");
    expect(recent.subscriptions?.status).toBe("expired");
    expect(recent.planGraceReason).toBe("lapsed");
    expect(recent.planGracePlan).toBe("ultra");
    expect(recent.planGraceEndsAt).toEqual(new Date(NOW.getTime() + 7 * DAY_MS));
    expect(nextEmail(recent)).toBe("started");

    // Cancelled with ends_at passed: mirrored, and the lapse path too.
    const cancelled = await load("active_cancelled_past");
    expect(cancelled.subscriptions?.status).toBe("cancelled");
    expect(cancelled.subscriptions?.endsAt).toEqual(ROWS.active_cancelled_past.endsAt);
    expect(cancelled.planGraceReason).toBe("lapsed");
    expect(nextEmail(cancelled)).toBe("started");

    // Unknown at the provider, or cancelled but still paid up: unchanged.
    for (const id of ["active_missing", "active_cancelled_future"] as const) {
      const account = await load(id);
      expect(account.subscriptions?.status).toBe("active");
      expect(account.subscriptions?.plan).toBe("ultra");
      expect(account.planGraceEndsAt).toBeNull();
    }

    // Idempotent: the next run changes nothing.
    expect(await syncProviderEndedSubscriptions(NOW, lookup)).toBe(0);
  });
});

describe.skipIf(!testDatabaseUrl)("syncProviderEndedSubscriptions: Paddle rows (MySQL)", () => {
  const PADDLE_USER = "grace_sync_paddle";
  const LS_USER = "grace_sync_paddle_ls";
  const PADDLE_ID = "sub_grace_sync_paddle";
  const LS_ID = 964001;
  const CANCELED_AT = "2026-11-18T09:00:00Z";

  const canceled: PaddleSubscription = {
    id: PADDLE_ID,
    status: "canceled",
    customer_id: "ctm_grace_sync",
    items: [{ price: { id: "pri_unknown" } }],
    scheduled_change: null,
    current_billing_period: null,
    next_billed_at: null,
    canceled_at: CANCELED_AT,
    started_at: "2026-10-18T09:00:00Z",
    created_at: "2026-10-18T09:00:00Z",
    updated_at: CANCELED_AT,
    custom_data: null,
  };

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function clean() {
    for (const id of [PADDLE_USER, LS_USER]) {
      await db.delete(schema.subscription).where(eq(schema.subscription.userId, id));
      await db.delete(schema.user).where(eq(schema.user.id, id));
    }
  }

  beforeEach(async () => {
    await clean();
    for (const id of [PADDLE_USER, LS_USER]) {
      await db.insert(schema.user).values({ id, email: `${id}@example.com` });
    }
    await db.insert(schema.subscription).values([
      {
        userId: PADDLE_USER,
        billingProvider: "paddle",
        subscriptionId: 0,
        variantId: 0,
        providerSubscriptionId: PADDLE_ID,
        providerCustomerId: "ctm_grace_sync",
        status: "active",
        plan: "pro",
        billingInterval: "monthly",
        providerUpdatedAt: new Date("2026-10-18T09:00:00Z"),
      },
      {
        userId: LS_USER,
        subscriptionId: LS_ID,
        status: "active",
        plan: "pro",
        variantId: PRO_VARIANT,
        providerUpdatedAt: new Date("2026-10-18T09:00:00Z"),
      },
    ]);
  });

  afterAll(clean);

  const stored = (id: string) =>
    db.query.subscription.findFirst({ where: eq(schema.subscription.userId, id) });

  test("looks up a Paddle row through Paddle and syncs a canceled subscription", async () => {
    const paddleLookups: string[] = [];
    const lemonSqueezyLookups: number[] = [];
    const paddle = {
      getSubscription: async (id: string) => {
        paddleLookups.push(id);
        return canceled;
      },
    };
    const lookup = async (sub: ProviderSubscriptionRef) => {
      if (sub.billingProvider === "paddle") return lookupProviderSubscription(sub, paddle);
      lemonSqueezyLookups.push(sub.subscriptionId ?? 0);
      return providerState("active");
    };

    expect(await syncProviderEndedSubscriptions(NOW, lookup)).toBe(1);
    expect(paddleLookups).toEqual([PADDLE_ID]);
    expect(lemonSqueezyLookups).toEqual([LS_ID]);

    const paddleRow = await stored(PADDLE_USER);
    expect(paddleRow?.status).toBe("expired");
    expect(paddleRow?.plan).toBe("free");
    expect(paddleRow?.endsAt).toEqual(new Date(CANCELED_AT));
    expect(paddleRow?.providerUpdatedAt).toEqual(new Date(CANCELED_AT));
    const account = await db.query.user.findFirst({ where: eq(schema.user.id, PADDLE_USER) });
    expect(account?.planGraceReason).toBe("lapsed");

    const lemonSqueezyRow = await stored(LS_USER);
    expect(lemonSqueezyRow?.status).toBe("active");
    expect(lemonSqueezyRow?.plan).toBe("pro");
  });

  test("leaves a Paddle row unchanged while Paddle isn't configured", async () => {
    const lookup = async (sub: ProviderSubscriptionRef) =>
      sub.billingProvider === "paddle"
        ? lookupProviderSubscription(sub, null)
        : providerState("active");
    expect(await syncProviderEndedSubscriptions(NOW, lookup)).toBe(0);
    expect((await stored(PADDLE_USER))?.status).toBe("active");
  });
});
