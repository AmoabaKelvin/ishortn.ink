import { addMonths } from "date-fns";

import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import { withAttribution } from "./attribution";
import { ACTIVE_PROMO, formatDayMonthYearShort, promoPrice } from "./promo";

import type { Attribution } from "./attribution";
import type { BillingInterval, Plan } from "./plans";
import type { Promo } from "./promo";

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
  /**
   * Price shown struck through: the monthly list price next to an annual figure, or during a
   * promo the undiscounted per-month price of the same interval.
   */
  compareAt: string | null;
  /** Line under the price, e.g. "billed $80 yearly". */
  note: string;
};

/**
 * During a promo, paid plans show their first-year price: the discount repeats for the first 12
 * monthly payments, or applies once to the first annual payment.
 */
export function planPriceDisplay(
  plan: Plan,
  interval: BillingInterval,
  promo: Promo | null = null,
): PlanPriceDisplay {
  if (plan === "free") {
    return { perMonth: formatUsd(PLAN_PRICES_USD.free), compareAt: null, note: "free forever" };
  }
  if (promo && interval === "annual") {
    const yearly = PLAN_PRICES_ANNUAL_USD[plan];
    const firstYear = promoPrice(yearly, promo);
    return {
      perMonth: formatUsd(firstYear / 12),
      compareAt: formatUsd(yearly / 12),
      note: `billed $${formatUsd(firstYear)} first year, then $${formatUsd(yearly)}/yr`,
    };
  }
  if (promo) {
    const monthly = PLAN_PRICES_USD[plan];
    return {
      perMonth: formatUsd(promoPrice(monthly, promo)),
      compareAt: formatUsd(monthly),
      note: `for 12 months, then $${formatUsd(monthly)}/mo`,
    };
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

/** How long a checkout discount lasts: 12 monthly payments, or the first annual payment. */
const DISCOUNT_MONTHS = 12;

export type SubscriptionDiscount = {
  code: string;
  /** Null for a code that isn't a known promo, so only "discount applied" can be shown. */
  percentOff: number | null;
  endsAt: Date;
};

type DiscountCheckout = {
  plan: Plan;
  interval: BillingInterval;
  promoCode: string | null;
  provider: string;
  createdAt: Date;
};

/**
 * The discount a subscription is still billed with, from the checkout that created it: the
 * user's latest checkout start, since a live subscription can't start another. It counts only
 * while the plan, interval and provider match that checkout, as a plan change may drop it.
 */
export function subscriptionDiscount(
  checkout: DiscountCheckout | null | undefined,
  subscription: { plan: Plan; interval: BillingInterval; provider: string },
  now = new Date(),
  promos: Promo[] = [ACTIVE_PROMO],
): SubscriptionDiscount | null {
  if (
    !checkout?.promoCode ||
    checkout.plan !== subscription.plan ||
    checkout.interval !== subscription.interval ||
    checkout.provider !== subscription.provider
  ) {
    return null;
  }
  const endsAt = addMonths(checkout.createdAt, DISCOUNT_MONTHS);
  if (now >= endsAt) return null;
  const code = checkout.promoCode;
  const promo = promos.find((candidate) => candidate.code === code);
  return { code, percentOff: promo?.percentOff ?? null, endsAt };
}

/** A subscriber's own price line: what they are billed, with the discount while it lasts. */
export function subscribedPriceDisplay(
  plan: Exclude<Plan, "free">,
  interval: BillingInterval,
  discount: SubscriptionDiscount | null,
): PlanPriceDisplay {
  const list = planPriceDisplay(plan, interval);
  if (!discount) return list;
  const { percentOff } = discount;
  if (percentOff === null) return { ...list, note: `${list.note}, discount applied` };

  const off = (price: number) => Math.round(price * (100 - percentOff)) / 100;
  const label = `${percentOff}% off with ${discount.code}`;
  if (interval === "annual") {
    const yearly = PLAN_PRICES_ANNUAL_USD[plan];
    const firstYear = off(yearly);
    return {
      perMonth: formatUsd(firstYear / 12),
      compareAt: formatUsd(yearly / 12),
      note: `billed $${formatUsd(firstYear)} the first year (${label}), then $${formatUsd(yearly)}/yr`,
    };
  }
  const monthly = PLAN_PRICES_USD[plan];
  return {
    perMonth: formatUsd(off(monthly)),
    compareAt: formatUsd(monthly),
    note: `${label} until ${formatDayMonthYearShort(discount.endsAt)}, then $${formatUsd(monthly)}/mo`,
  };
}

/**
 * Sign-up link for a paid plan; after sign-up the dashboard pricing page starts its checkout,
 * attributed to the visit's source and UTM tags.
 */
export function planSignupHref(
  plan: Exclude<Plan, "free">,
  interval: BillingInterval,
  attribution: Attribution = {},
): string {
  const next = withAttribution(`/dashboard/pricing?plan=${plan}&interval=${interval}`, attribution);
  return `/auth/sign-up?next=${encodeURIComponent(next)}`;
}
