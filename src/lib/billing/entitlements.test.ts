import { describe, expect, test } from "bun:test";

import {
  describeOverPlanFeature,
  dueGraceEmail,
  effectivePlan,
  EMPTY_USAGE,
  GRACE_EMAIL_STAGE,
  GRACE_PERIOD_MS,
  graceChangeAfterBillingEvent,
  NO_GRACE,
  overPlanFeatures,
  paidPlan,
  planForFeature,
  requiredPlanForUsage,
  teamAccess,
} from "./entitlements";

import type { PlanGrace } from "./entitlements";
import type { Plan } from "./plans";

const NOW = new Date("2026-11-20T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

const PRO_VARIANT = 1811616;
const ULTRA_VARIANT = 1108002;

function sub(status: string, plan: Exclude<Plan, "free">, endsAt: Date | null = null) {
  return {
    status,
    plan,
    endsAt,
    variantId: plan === "pro" ? PRO_VARIANT : ULTRA_VARIANT,
    productId: 0,
  };
}

const grace = (plan: Plan, endsAt: Date): PlanGrace => ({
  planGracePlan: plan,
  planGraceEndsAt: endsAt,
});

describe("paidPlan", () => {
  test.each([
    ["active", "pro"],
    ["on_trial", "pro"],
    ["past_due", "free"],
    ["unpaid", "free"],
    ["expired", "free"],
    ["paused", "free"],
  ] as const)("%s Pro subscription pays for %s", (status, expected) => {
    expect(paidPlan(sub(status, "pro"), NOW)).toBe(expected);
  });

  test("cancelled counts until the paid period ends", () => {
    expect(paidPlan(sub("cancelled", "ultra", at(3)), NOW)).toBe("ultra");
    expect(paidPlan(sub("cancelled", "ultra", at(-1)), NOW)).toBe("free");
  });

  test("no subscription is free", () => {
    expect(paidPlan(null, NOW)).toBe("free");
  });
});

describe("effectivePlan", () => {
  test("a failed payment keeps the plan until its grace period is recorded", () => {
    expect(effectivePlan(sub("past_due", "pro"), NO_GRACE, NOW)).toBe("pro");
  });

  test("past_due counts only during the grace period", () => {
    expect(effectivePlan(sub("past_due", "pro"), grace("pro", at(2)), NOW)).toBe("pro");
    expect(effectivePlan(sub("past_due", "pro"), grace("pro", at(-1)), NOW)).toBe("free");
  });

  test("lapsed accounts keep the grace plan for the grace period, then drop to Free", () => {
    const expired = sub("expired", "pro");
    expect(effectivePlan(expired, grace("pro", at(6)), NOW)).toBe("pro");
    expect(effectivePlan(expired, grace("pro", at(-0.01)), NOW)).toBe("free");
  });

  test("a grace plan never lowers a higher paid plan", () => {
    expect(effectivePlan(sub("active", "ultra"), grace("pro", at(5)), NOW)).toBe("ultra");
  });
});

describe("graceChangeAfterBillingEvent", () => {
  test("expiry starts a 7-day grace at the plan the account had", () => {
    const change = graceChangeAfterBillingEvent({
      before: "pro",
      subscription: sub("expired", "pro"),
      grace: NO_GRACE,
      now: NOW,
    });
    expect(change).toEqual({
      type: "start",
      plan: "pro",
      endsAt: new Date(NOW.getTime() + GRACE_PERIOD_MS),
    });
  });

  test("a failed payment starts the grace period", () => {
    const previous = sub("active", "ultra");
    const change = graceChangeAfterBillingEvent({
      before: effectivePlan(previous, NO_GRACE, NOW),
      subscription: sub("past_due", "ultra"),
      grace: NO_GRACE,
      now: NOW,
    });
    expect(change.type).toBe("start");
    expect(change.type === "start" && change.plan).toBe("ultra");
  });

  test("cancelling inside the paid period changes nothing", () => {
    const change = graceChangeAfterBillingEvent({
      before: "pro",
      subscription: sub("cancelled", "pro", at(20)),
      grace: NO_GRACE,
      now: NOW,
    });
    expect(change.type).toBe("none");
  });

  test("an active grace period is never restarted or extended", () => {
    const change = graceChangeAfterBillingEvent({
      before: "pro",
      subscription: sub("unpaid", "pro"),
      grace: grace("pro", at(3)),
      now: NOW,
    });
    expect(change.type).toBe("none");
  });

  test("once grace has passed, a later status change doesn't start another", () => {
    const expired = grace("pro", at(-2));
    const change = graceChangeAfterBillingEvent({
      before: effectivePlan(sub("past_due", "pro"), expired, NOW),
      subscription: sub("expired", "pro"),
      grace: expired,
      now: NOW,
    });
    expect(change.type).toBe("none");
  });

  test("resubscribing clears the grace period, active or passed", () => {
    for (const ends of [at(3), at(-30)]) {
      const change = graceChangeAfterBillingEvent({
        before: "free",
        subscription: sub("active", "pro"),
        grace: grace("pro", ends),
        now: NOW,
      });
      expect(change.type).toBe("clear");
    }
  });

  test("resubscribing to a lower plan keeps the grace for the higher one", () => {
    const change = graceChangeAfterBillingEvent({
      before: "ultra",
      subscription: sub("active", "pro"),
      grace: grace("ultra", at(3)),
      now: NOW,
    });
    expect(change.type).toBe("none");
  });

  test("choosing a lower plan is not a lapse", () => {
    const change = graceChangeAfterBillingEvent({
      before: "ultra",
      subscription: sub("active", "pro"),
      grace: NO_GRACE,
      now: NOW,
    });
    expect(change.type).toBe("none");
  });
});

describe("teamAccess", () => {
  test("Ultra owners give the team Ultra", () => {
    expect(teamAccess("ultra", at(-3), NOW)).toEqual({
      plan: "ultra",
      readOnly: false,
      graceEndsAt: null,
    });
  });

  test("an owner below Ultra keeps the team writable through the grace period", () => {
    expect(teamAccess("pro", at(2), NOW)).toMatchObject({ plan: "ultra", readOnly: false });
    expect(teamAccess("pro", null, NOW)).toMatchObject({ plan: "ultra", readOnly: false });
  });

  test("after grace, a Pro- or Free-owned team is read-only", () => {
    expect(teamAccess("pro", at(-0.01), NOW)).toMatchObject({ plan: "pro", readOnly: true });
    expect(teamAccess("free", at(-5), NOW)).toMatchObject({ plan: "free", readOnly: true });
  });
});

describe("dueGraceEmail", () => {
  const lapsed = (days: number, stage: number) =>
    dueGraceEmail({ reason: "lapsed", endsAt: at(7), stage, now: at(days) });
  const overPlan = (days: number, stage: number) =>
    dueGraceEmail({ reason: "over_plan", endsAt: at(7), stage, now: at(days) });

  test("lapsed subscriptions are emailed on day 0, day 5 and day 7", () => {
    expect(lapsed(0, GRACE_EMAIL_STAGE.none)).toBe("started");
    expect(lapsed(1, GRACE_EMAIL_STAGE.started)).toBeNull();
    expect(lapsed(4.9, GRACE_EMAIL_STAGE.started)).toBeNull();
    expect(lapsed(5, GRACE_EMAIL_STAGE.started)).toBe("reminder");
    expect(lapsed(6, GRACE_EMAIL_STAGE.reminder)).toBeNull();
    expect(lapsed(7, GRACE_EMAIL_STAGE.reminder)).toBe("ended");
    expect(lapsed(8, GRACE_EMAIL_STAGE.ended)).toBeNull();
  });

  test("over-plan accounts are emailed on day 0 and 24 hours before the end, not after", () => {
    expect(overPlan(0, GRACE_EMAIL_STAGE.none)).toBe("started");
    expect(overPlan(5, GRACE_EMAIL_STAGE.started)).toBeNull();
    expect(overPlan(6, GRACE_EMAIL_STAGE.started)).toBe("reminder");
    expect(overPlan(7, GRACE_EMAIL_STAGE.reminder)).toBeNull();
  });

  test("cron jitter only delays a reminder to the next hourly run", () => {
    const SECOND = 1000;
    const HOUR = 60 * 60 * SECOND;
    // The run on day 6 starts a few seconds earlier than the run that started the grace.
    const day6 = at(6).getTime() - 3 * SECOND;
    expect(
      dueGraceEmail({
        reason: "over_plan",
        endsAt: at(7),
        stage: GRACE_EMAIL_STAGE.started,
        now: new Date(day6),
      }),
    ).toBeNull();
    expect(
      dueGraceEmail({
        reason: "over_plan",
        endsAt: at(7),
        stage: GRACE_EMAIL_STAGE.started,
        now: new Date(day6 + HOUR),
      }),
    ).toBe("reminder");
    // A lapse started by a webhook at an arbitrary time still gets its day-5
    // reminder, and its day-7 email, within the hour.
    const endsAt = new Date(at(7).getTime() + 5 * HOUR + 17 * SECOND);
    expect(
      dueGraceEmail({
        reason: "lapsed",
        endsAt,
        stage: GRACE_EMAIL_STAGE.started,
        now: new Date(at(5).getTime() + 6 * HOUR),
      }),
    ).toBe("reminder");
    expect(
      dueGraceEmail({
        reason: "lapsed",
        endsAt,
        stage: GRACE_EMAIL_STAGE.reminder,
        now: new Date(endsAt.getTime() + HOUR - SECOND),
      }),
    ).toBe("ended");
  });

  test("a start email is never sent once grace is over", () => {
    expect(overPlan(8, GRACE_EMAIL_STAGE.none)).toBeNull();
  });
});

describe("usage above a plan", () => {
  test("planForFeature picks the lowest plan whose allowance covers the amount", () => {
    expect(planForFeature("customDomains", 0)).toBe("free");
    expect(planForFeature("customDomains", 1)).toBe("pro");
    expect(planForFeature("customDomains", 3)).toBe("pro");
    expect(planForFeature("customDomains", 4)).toBe("ultra");
    expect(planForFeature("bioPages", 1)).toBe("free");
    expect(planForFeature("maxTargetingRulesPerLink", 4)).toBe("ultra");
    expect(planForFeature("passwordLinks", 2)).toBe("pro");
    expect(planForFeature("cloakedLinks", 1)).toBe("ultra");
    expect(planForFeature("qrCodes", 6)).toBe("pro");
  });

  test("a lapsed Pro account with three domains and password links needs Pro", () => {
    const usage = { ...EMPTY_USAGE, customDomains: 3, passwordLinks: 4 };
    expect(overPlanFeatures(usage, "free").map((item) => item.feature)).toEqual([
      "customDomains",
      "passwordLinks",
    ]);
    expect(overPlanFeatures(usage, "pro")).toEqual([]);
    expect(requiredPlanForUsage(usage)).toBe("pro");
  });

  test("Ultra-only features need Ultra even on Pro", () => {
    const usage = { ...EMPTY_USAGE, utmLinks: 2, customDomains: 5 };
    expect(overPlanFeatures(usage, "pro").map((item) => item.requiredPlan)).toEqual([
      "ultra",
      "ultra",
    ]);
    expect(overPlanFeatures(usage, "ultra")).toEqual([]);
  });

  test("describeOverPlanFeature phrases counts and per-item maximums", () => {
    const [domains, rules] = overPlanFeatures(
      { ...EMPTY_USAGE, customDomains: 4, maxTargetingRulesPerLink: 5 },
      "pro",
    );
    expect(describeOverPlanFeature(domains!, "Pro")).toBe("Custom domains: 4 (Pro includes 3)");
    expect(describeOverPlanFeature(rules!, "Pro")).toBe(
      "Targeting rules on a link: up to 5 (Pro includes 3)",
    );
    const [passwords] = overPlanFeatures({ ...EMPTY_USAGE, passwordLinks: 1 }, "free");
    expect(describeOverPlanFeature(passwords!, "Free")).toBe(
      "Password-protected links: 1 (not included in Free)",
    );
  });
});
