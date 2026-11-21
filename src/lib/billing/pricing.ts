import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import type { BillingInterval, Plan } from "./plans";

/**
 * Interval a pricing surface opens on. An explicit `?interval=` wins; otherwise free accounts
 * (and signed-out visitors) see annual, and paying subscribers see the interval they are on so
 * their current plan reads as current instead of offering a switch.
 */
export function resolveBillingInterval(
  param: string | null | undefined,
  currentPlan: Plan = "free",
  currentInterval: BillingInterval = "monthly",
): BillingInterval {
  if (param === "monthly" || param === "annual") return param;
  return currentPlan === "free" ? "annual" : currentInterval;
}

/** Whole dollars render without cents ("8"), fractional amounts with two decimals ("6.67"). */
export function formatUsd(amount: number): string {
  const cents = Math.round(amount * 100);
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export type PlanPriceDisplay = {
  /** Headline per-month figure, without the "$". */
  perMonth: string;
  /** Monthly list price shown struck through next to an annual figure. */
  compareAt: string | null;
  /** Line under the price, e.g. "billed $80 yearly". */
  note: string;
};

export function planPriceDisplay(plan: Plan, interval: BillingInterval): PlanPriceDisplay {
  if (plan === "free") {
    return { perMonth: formatUsd(PLAN_PRICES_USD.free), compareAt: null, note: "free forever" };
  }
  if (interval === "annual") {
    const yearly = PLAN_PRICES_ANNUAL_USD[plan];
    return {
      perMonth: formatUsd(yearly / 12),
      compareAt: formatUsd(PLAN_PRICES_USD[plan]),
      note: `billed $${formatUsd(yearly)} yearly`,
    };
  }
  return { perMonth: formatUsd(PLAN_PRICES_USD[plan]), compareAt: null, note: "billed monthly" };
}

/** Sign-up link for a paid plan; after sign-up the dashboard pricing page starts its checkout. */
export function planSignupHref(plan: Exclude<Plan, "free">, interval: BillingInterval): string {
  const next = `/dashboard/pricing?plan=${plan}&interval=${interval}`;
  return `/auth/sign-up?next=${encodeURIComponent(next)}`;
}
