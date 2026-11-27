import { describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { createElement } from "react";

import { planGraceSubject } from "./_components/plan-grace-subject";
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

  test("a failed payment states it in the subject and the preview text", async () => {
    const props = { ...base, updatePaymentUrl: UPDATE_URL };
    expect(planGraceSubject(props)).toBe("Your iShortn Pro payment didn't go through");
    expect(planGraceSubject({ ...props, kind: "reminder" })).toBe(
      "Update your card by November 27, 2026 to keep Pro",
    );
    const html = await renderEmail(props);
    expect(html).toContain(
      "Update your card by November 27, 2026 to keep Pro. Your links keep working either way.",
    );
    expect(html).toMatch(/<h1[^>]*>Your iShortn Pro payment didn&#x27;t go through<\/h1>/);
  });

  test("a cancellation names what to keep and says nothing is deleted", async () => {
    expect(planGraceSubject(base)).toBe("Keep your Pro features after November 27, 2026");
    expect(planGraceSubject({ ...base, kind: "reminder" })).toBe(
      "7 days left to keep your Pro features",
    );
    const html = await renderEmail({});
    expect(html).toContain(
      "Nothing is deleted. After November 27, 2026, these features can&#x27;t be added or changed on Free.",
    );
  });

  test("a team grace keeps naming the team", () => {
    const team = { ...base, reason: "team" as const, teamName: "Acme" };
    expect(planGraceSubject(team)).toBe(
      "Acme needs Ultra to stay editable after November 27, 2026",
    );
    expect(planGraceSubject({ ...team, kind: "reminder" })).toBe(
      "Acme becomes read-only on November 27, 2026",
    );
  });
});
