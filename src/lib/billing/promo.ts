export type Promo = {
  /** Lemon Squeezy discount code applied to new checkouts. */
  code: string;
  percentOff: number;
  /** Inclusive ISO-8601 instants (UTC). */
  startsAt: string;
  endsAt: string;
  label: string;
  /** `utm_campaign` on in-app links to the offer. */
  utmCampaign: string;
};

export const ACTIVE_PROMO: Promo = {
  code: "BFCM20",
  percentOff: 20,
  startsAt: "2026-11-25T00:00:00Z",
  endsAt: "2026-12-01T23:59:59Z",
  label: "Black Friday",
  utmCampaign: "bfcm2026",
};

/** A promo that discounts the first year of a subscription (first-year-discount.ts). */
export type FirstYearPromo = { code: string; percentOff: number; kind: "first_year" };

/**
 * Every first-year promo code ever offered, past campaigns included: plan changes on a promo
 * subscription follow the first-year rules long after its campaign ends. Add each new campaign's
 * code here before it goes live; never remove one.
 */
export const FIRST_YEAR_PROMOS: readonly FirstYearPromo[] = [
  { code: "BFCM20", percentOff: 20, kind: "first_year" },
];

export function findFirstYearPromo(code: string | null | undefined): FirstYearPromo | null {
  return (code && FIRST_YEAR_PROMOS.find((promo) => promo.code === code)) || null;
}

/** The promo running at `now`, or null outside its window. */
export function getActivePromo(now = new Date(), promo: Promo = ACTIVE_PROMO): Promo | null {
  const t = now.getTime();
  return t >= Date.parse(promo.startsAt) && t <= Date.parse(promo.endsAt) ? promo : null;
}

/** List price with the promo's discount, rounded to cents. */
export function promoPrice(listPrice: number, promo: Promo): number {
  return Math.round(listPrice * (100 - promo.percentOff)) / 100;
}

/**
 * Discount code for a new subscription checkout at `now`. Plan changes and resumes go through
 * updateSubscription and never get it.
 */
export function checkoutDiscountCode(now = new Date()): string | undefined {
  return getActivePromo(now)?.code;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Built by hand rather than with toLocaleDateString: the banner renders on the server and
// hydrates in the browser, and ICU punctuation differs between runtimes ("Tuesday, 1 December").
/** "27 November", in UTC. */
export function formatDayMonth(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "Tuesday 1 December", in UTC. */
export function formatPromoEnd(iso: string): string {
  const date = new Date(iso);
  return `${WEEKDAYS[date.getUTCDay()]} ${formatDayMonth(date)}`;
}

/** "Tue 1 Dec", in UTC, for tight spaces like the sidebar. */
export function formatPromoEndShort(iso: string): string {
  const date = new Date(iso);
  return `${WEEKDAYS[date.getUTCDay()]!.slice(0, 3)} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]!.slice(0, 3)}`;
}

/** "25 Nov 2027", in UTC. */
export function formatDayMonthYearShort(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]!.slice(0, 3)} ${date.getUTCFullYear()}`;
}

/** One-line announcement shown above the plan cards while the promo runs. */
export function promoBannerText(promo: Promo): string {
  return `${promo.label}: ${promo.percentOff}% off your first year of Pro or Ultra. Applied at checkout, until ${formatPromoEnd(promo.endsAt)}.`;
}

/**
 * One-line offer appended to the paused-tracking banner and the event-cap emails, e.g.
 * "Black Friday: Pro is 20% off your first year until Tuesday 1 December."
 */
export function promoOfferLine(promo: Promo, planName: string): string {
  return `${promo.label}: ${planName} is ${promo.percentOff}% off your first year until ${formatPromoEnd(promo.endsAt)}.`;
}
