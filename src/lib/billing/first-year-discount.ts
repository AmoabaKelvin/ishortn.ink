import { addMonths, differenceInMonths, subDays } from "date-fns";

import type { BillingInterval } from "./plans";

// A first-year promo covers the first 12 monthly payments, or the first annual payment. Paddle
// counts a discount's recurrences per billing period, so a single 12-recurrence discount would
// discount 12 years of an annual subscription; every discount here is picked per interval.

export const FIRST_YEAR_MONTHS = 12;

/** How many billing periods a Paddle discount applies to. */
export type DiscountTerms =
  | { recur: true; maximumRecurringIntervals: number }
  | { recur: false; maximumRecurringIntervals: null };

const oneOff: DiscountTerms = { recur: false, maximumRecurringIntervals: null };
const recurring = (intervals: number): DiscountTerms => ({
  recur: true,
  maximumRecurringIntervals: intervals,
});

/** Terms of the discount a new checkout applies: 12 monthly payments, or one annual payment. */
export function checkoutDiscountTerms(interval: BillingInterval): DiscountTerms {
  return interval === "monthly" ? recurring(FIRST_YEAR_MONTHS) : oneOff;
}

/**
 * Paddle discount code for a promo code at an interval. Paddle codes are unique and carry their
 * own recurrence, so the annual one-off discount needs a code of its own.
 */
export function paddleDiscountCode(code: string, interval: BillingInterval): string {
  return interval === "monthly" ? code : `${code}ANNUAL`;
}

export type PlanChangeDiscount =
  | { action: "remove" }
  | { action: "apply"; terms: DiscountTerms; effectiveFrom: "immediately" | "next_billing_period" };

const remove: PlanChangeDiscount = { action: "remove" };

/**
 * The promo discount a subscription gets on a plan or interval change, from its first payment.
 * Within the first year, monthly keeps the discount for the rest of that year's monthly payments
 * (a Pro/Ultra switch), and a change billed now to annual gets it once on that annual charge.
 * Nothing carries past the first year, nothing moves from annual back to monthly, and a change
 * billed at the next renewal only covers the monthly payments still to come.
 */
export function planChangeDiscount(input: {
  firstPaymentAt: Date;
  from: BillingInterval;
  to: BillingInterval;
  /** The change is charged now (`prorated_immediately`), not at the next renewal. */
  billsNow: boolean;
  now?: Date;
}): PlanChangeDiscount {
  const { firstPaymentAt, from, to, billsNow, now = new Date() } = input;
  // Index of the billing month `now` falls in, counted from the first payment.
  const month = differenceInMonths(now, firstPaymentAt);
  if (month < 0 || month >= FIRST_YEAR_MONTHS) return remove;

  if (to === "annual") {
    return billsNow ? { action: "apply", terms: oneOff, effectiveFrom: "immediately" } : remove;
  }
  if (from === "annual") return remove;

  // Applied now, the current period (with its prorated charge) is the first one it covers.
  const periods = FIRST_YEAR_MONTHS - month - (billsNow ? 0 : 1);
  if (periods <= 0) return remove;
  return {
    action: "apply",
    terms: recurring(periods),
    effectiveFrom: billsNow ? "immediately" : "next_billing_period",
  };
}

/**
 * Whether a first-year promo still discounts the subscription now, under the rules above:
 * monthly while the first year runs and the checkout was monthly; annual while the current annual
 * period started in the first year. `periodEndsAt` is the end of the current period. Once a plan
 * change has removed the discount (`endedAt`, e.g. annual back to monthly) nothing counts.
 */
export function promoDiscountActive(input: {
  checkoutInterval: BillingInterval;
  interval: BillingInterval;
  firstPaymentAt: Date;
  periodEndsAt: Date | null;
  endedAt?: Date | null;
  now?: Date;
}): { endsAt: Date } | null {
  const {
    checkoutInterval,
    interval,
    firstPaymentAt,
    periodEndsAt,
    endedAt,
    now = new Date(),
  } = input;
  if (endedAt && endedAt >= firstPaymentAt) return null;
  const firstYearEnd = addMonths(firstPaymentAt, FIRST_YEAR_MONTHS);
  if (interval === "monthly") {
    return checkoutInterval === "monthly" && now < firstYearEnd ? { endsAt: firstYearEnd } : null;
  }
  if (!periodEndsAt) {
    return checkoutInterval === "annual" && now < firstYearEnd ? { endsAt: firstYearEnd } : null;
  }
  // Paddle anchors the period on started_at, a moment before created_at (firstPaymentAt), so the
  // second annual period starts just before firstYearEnd; a day of slack keeps it out.
  const periodStart = addMonths(periodEndsAt, -FIRST_YEAR_MONTHS);
  return now < periodEndsAt && periodStart < subDays(firstYearEnd, 1)
    ? { endsAt: periodEndsAt }
    : null;
}

/**
 * When a promo subscription's first year started. A returning customer's Subscription row is
 * reused (one per user), so its createdAt can be an older subscription's; the checkout start
 * always comes just before its own subscription, so the later of the two is this one's start.
 */
export function promoFirstPaymentAt(
  subscriptionCreatedAt: Date | null | undefined,
  checkoutCreatedAt: Date,
): Date {
  return subscriptionCreatedAt && subscriptionCreatedAt > checkoutCreatedAt
    ? subscriptionCreatedAt
    : checkoutCreatedAt;
}
