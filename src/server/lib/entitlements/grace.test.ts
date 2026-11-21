import { describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { createElement } from "react";

import PlanGraceEmail from "@/emails/plan-grace";
import { EMPTY_USAGE } from "@/lib/billing/entitlements";

import { accountGraceEmail, teamGraceEmail } from "./grace";

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

const accountEmail = (sub: Subscription, gracePlan: Plan, reason: "lapsed" | "over_plan") =>
  accountGraceEmail({
    name: "Ama",
    subscription: sub,
    usage: { ...EMPTY_USAGE, customDomains: 3 },
    gracePlan,
    reason,
    endsAt: ENDS_AT,
    kind: "started",
    now: NOW,
  });

describe("accountGraceEmail", () => {
  test("the day-0 email for an unpaid subscription asks for a payment method update", async () => {
    const { subject, props } = accountEmail(ownerSubscription("unpaid"), "ultra", "lapsed");
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
    const { subject, props } = accountEmail(ownerSubscription("unpaid", "pro"), "pro", "over_plan");
    expect(subject).toBe("Your iShortn Pro payment didn't go through");
    expect(props.updatePaymentUrl).toBeDefined();
  });

  test("an over-plan grace above the unpaid subscription's plan keeps the pricing link", () => {
    const { subject, props } = accountEmail(
      ownerSubscription("unpaid", "pro"),
      "ultra",
      "over_plan",
    );
    expect(subject).toBe("Some of your iShortn features need Ultra after November 27, 2026");
    expect(props.updatePaymentUrl).toBeUndefined();
    expect(props.upgradeUrl).toContain("/dashboard/pricing?plan=ultra");
  });
});
