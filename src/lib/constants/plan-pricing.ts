export const PLAN_PRICES_USD = {
  free: 0,
  pro: 8,
  ultra: 15,
} as const;

// The original Pro monthly price, still billed to subscribers on the grandfathered variant
// (PRO_LEGACY_MONTHLY_VARIANT_ID in lib/billing/plans.ts) until they cancel.
export const PRO_LEGACY_MONTHLY_PRICE_USD = 5;

// Annual prices = 10x monthly, i.e. "2 months free".
export const PLAN_PRICES_ANNUAL_USD = {
  pro: 80,
  ultra: 150,
} as const;

export type PaidPlan = "pro" | "ultra";
export const PAID_PLANS: PaidPlan[] = ["pro", "ultra"];
