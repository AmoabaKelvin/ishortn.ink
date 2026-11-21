import { describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { createElement } from "react";

import PlanGraceEmail from "@/emails/plan-grace";

import { teamGraceEmail } from "./grace";

import type { Subscription } from "@/server/db/schema";

const NOW = new Date("2026-11-20T12:00:00Z");
const ENDS_AT = new Date("2026-11-27T12:00:00Z");
const ULTRA_VARIANT = 1108002;

function ownerSubscription(status: string): Subscription {
  // SAFETY: teamGraceEmail reads only the status and plan fields of the subscription.
  return {
    status,
    plan: "ultra",
    variantId: ULTRA_VARIANT,
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
