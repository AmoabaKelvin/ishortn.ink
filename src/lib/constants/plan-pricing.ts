export const PLAN_PRICES_USD = {
  free: 0,
  pro: 5,
  ultra: 15,
} as const;

export type PaidPlan = "pro" | "ultra";
export const PAID_PLANS: PaidPlan[] = ["pro", "ultra"];
