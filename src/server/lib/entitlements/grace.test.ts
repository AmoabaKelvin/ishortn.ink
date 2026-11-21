import { describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { createElement } from "react";

import PlanGraceEmail from "@/emails/plan-grace";
import { EMPTY_USAGE } from "@/lib/billing/entitlements";

import { accountGraceEmail, overPlanGrace, teamGraceEmail } from "./grace";

import type { PlanUsage } from "@/lib/billing/entitlements";
import type { Plan } from "@/lib/billing/plans";
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
    ownerName: "Ama",
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
    name: "Ama",
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
    expect(html).not.toContain("/dashboard/pricing");
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
    expect(subject).toBe("Some of your iShortn features need Ultra after November 27, 2026");
    expect(props.updatePaymentUrl).toBeUndefined();
    expect(props.upgradeUrl).toContain("/dashboard/pricing?plan=ultra");
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
    ["a link with UTM parameters", { utmLinks: 1 }, "ultra"],
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
