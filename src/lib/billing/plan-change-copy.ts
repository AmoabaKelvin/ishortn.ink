import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import type { BillingInterval, Plan } from "@/lib/billing/plans";

export type PlanChangeKind = "switch" | "upgrade";

/**
 * What an in-place plan change charges today:
 * - `list_price`: no preview exists (Lemon Squeezy); the copy quotes the list price.
 * - `amount_due`: Paddle's preview, prorated and discounted, in the currency's lowest
 *   denomination (cents for USD).
 * - `prorated`: a Paddle preview was expected but failed.
 */
export type PlanChangeCharge =
  | { type: "list_price" }
  | { type: "amount_due"; amount: number; currencyCode: string }
  | { type: "prorated" };

export type PlanChangeCopy = {
  title: string;
  description: string;
  note?: string;
  confirmLabel: string;
};

/** Formats an amount in the currency's lowest denomination, e.g. 609 USD → "$6.09". */
export function formatMinorUnits(amount: number, currencyCode: string): string {
  const format = new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode });
  const fractionDigits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** fractionDigits);
}

/**
 * Copy for confirming an immediate-charge, in-place plan change: an interval switch or an
 * upgrade from an existing paid plan, which charge the card on click.
 */
export function buildPlanChangeCopy(
  kind: PlanChangeKind,
  targetPlan: Exclude<Plan, "free">,
  interval: BillingInterval,
  charge: PlanChangeCharge = { type: "list_price" },
): PlanChangeCopy {
  const listPrice =
    interval === "annual" ? PLAN_PRICES_ANNUAL_USD[targetPlan] : PLAN_PRICES_USD[targetPlan];
  const planName = targetPlan === "pro" ? "Pro" : "Ultra";
  const due =
    charge.type === "amount_due" ? formatMinorUnits(charge.amount, charge.currencyCode) : null;
  const nothingDue = charge.type === "amount_due" && charge.amount <= 0;

  if (kind === "switch") {
    if (interval === "annual") {
      return {
        title: "Switch to annual billing?",
        description: nothingDue
          ? "Nothing is due today: your account credit covers the annual charge."
          : due
            ? `You'll be charged ${due} today, after credit for the unused part of your current month.`
            : charge.type === "prorated"
              ? "You'll be charged the annual price today, less credit for the unused part of your current month."
              : `You'll be charged $${listPrice} today, with credit for the unused part of your current month.`,
        note: "That's 2 months free compared to paying monthly.",
        confirmLabel: "Switch & save",
      };
    }
    return {
      title: "Switch to monthly billing?",
      description:
        due && !nothingDue
          ? `You'll be charged ${due} today and move to $${listPrice}/month.`
          : `You'll move to $${listPrice}/month. Any unused time on your annual plan is credited to your account.`,
      confirmLabel: "Switch to monthly",
    };
  }

  const planLabel = `${planName} ${interval === "annual" ? "annual" : "monthly"}`;
  return {
    title: `Upgrade to ${planName}?`,
    description: nothingDue
      ? `Nothing is due today: credit for the unused time on your current plan covers ${planLabel}.`
      : due
        ? `You'll be charged ${due} today for ${planLabel}, after credit for the unused time on your current plan.`
        : charge.type === "prorated"
          ? `You'll be charged a prorated amount today for ${planLabel}, after credit for the unused time on your current plan.`
          : `You'll be charged $${listPrice} today for ${planLabel}, with credit for the unused time on your current plan.`,
    confirmLabel: `Upgrade to ${planName}`,
  };
}
