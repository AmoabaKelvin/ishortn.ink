import { describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { createElement } from "react";

import PlanGraceEmail from "./plan-grace";

import type { PlanGraceEmailProps } from "./plan-grace";

const UPDATE_URL = "https://ishortn.ink/dashboard/settings/billing/update-payment?source=email";
const base: PlanGraceEmailProps = { ...PlanGraceEmail.PreviewProps };

const renderEmail = (props: Partial<PlanGraceEmailProps>) =>
  render(createElement(PlanGraceEmail, { ...base, ...props }));

describe("PlanGraceEmail", () => {
  test("a failed payment links to the update-payment-method page", async () => {
    for (const kind of ["started", "reminder", "ended"] as const) {
      const html = await renderEmail({ kind, updatePaymentUrl: UPDATE_URL });
      expect(html).toContain("Update payment method");
      expect(html).toContain(`href="${UPDATE_URL}"`);
      expect(html).not.toContain(base.upgradeUrl);
      expect(html).not.toContain("Upgrade to Pro");
    }
  });

  test("the started email says the payment failed", async () => {
    const html = await renderEmail({ kind: "started", updatePaymentUrl: UPDATE_URL });
    expect(html).toContain("didn&#x27;t go through");
  });

  test("a cancellation keeps the pricing link", async () => {
    const html = await renderEmail({ kind: "started" });
    expect(html).toContain("Upgrade to Pro");
    expect(html).toContain(`href="${base.upgradeUrl}"`);
    expect(html).not.toContain("Update payment method");
  });
});
