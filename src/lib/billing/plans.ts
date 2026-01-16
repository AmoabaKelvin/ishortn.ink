import type { Subscription } from "@/server/db/schema";

export type Plan = "free" | "pro" | "ultra";

type PlanCaps = {
  eventsLimit?: number; // undefined => unlimited
  linksLimit?: number;
  folderLimit?: number;
  analyticsRangeLimitDays?: number;
  domainLimit?: number;
  geoRulesLimit?: number; // Max geo rules per link (undefined => unlimited)
};

const PRO_VARIANT_IDS = new Set([441105, 415248]);
const PRO_PRODUCT_IDS = new Set([441105, 306137]); // include known sample payload product_id
const ULTRA_VARIANT_IDS = new Set([1108002, 1134595]);
const ULTRA_PRODUCT_IDS = new Set([1108002]);

export const PLAN_VARIANT_IDS: Record<Exclude<Plan, "free">, number> = {
  // todo: make sure you change these back before pushing
  pro: 441105,
  ultra: 1108002,

  // test mode ids
  // pro: 415248,
  // ultra: 1134595,
};

export const PLAN_CAPS: Record<Plan, PlanCaps> = {
  free: {
    eventsLimit: 1000,
    linksLimit: 30,
    folderLimit: 0,
    analyticsRangeLimitDays: 7,
    geoRulesLimit: 0, // Geotargeting not available for free plan
  },
  pro: {
    eventsLimit: 10000,
    linksLimit: 1000,
    folderLimit: 5,
    domainLimit: 3,
    geoRulesLimit: 3, // Pro plan allows 3 geo rules per link
  },
  ultra: {
    // unlimited
  },
};

export function getPlanFromIds(
  variantId?: number | null,
  productId?: number | null
): Plan | null {
  if (variantId && ULTRA_VARIANT_IDS.has(variantId)) return "ultra";
  if (productId && ULTRA_PRODUCT_IDS.has(productId)) return "ultra";
  if (variantId && PRO_VARIANT_IDS.has(variantId)) return "pro";
  if (productId && PRO_PRODUCT_IDS.has(productId)) return "pro";
  return null;
}

export function resolvePlan(subscription?: Subscription | null): Plan {
  if (!subscription || subscription.status !== "active") {
    return "free";
  }

  const mappedPlan =
    getPlanFromIds(subscription.variantId, subscription.productId) ??
    subscription.plan;

  if (mappedPlan === "ultra" || mappedPlan === "pro") {
    return mappedPlan;
  }

  return "pro"; // active subscription without recognized plan defaults to pro
}

export function getPlanCaps(plan: Plan): PlanCaps {
  return PLAN_CAPS[plan];
}

export function isUnlimitedEvents(plan: Plan): boolean {
  return PLAN_CAPS[plan].eventsLimit === undefined;
}

export function isUnlimitedLinks(plan: Plan): boolean {
  return PLAN_CAPS[plan].linksLimit === undefined;
}

export function isUnlimitedFolders(plan: Plan): boolean {
  return PLAN_CAPS[plan].folderLimit === undefined;
}

export function isUnlimitedDomains(plan: Plan): boolean {
  return PLAN_CAPS[plan].domainLimit === undefined;
}

export function getGeoRulesLimit(plan: Plan): number | undefined {
  return PLAN_CAPS[plan].geoRulesLimit;
}

export function isUnlimitedGeoRules(plan: Plan): boolean {
  return PLAN_CAPS[plan].geoRulesLimit === undefined;
}

export function canUseGeoRules(plan: Plan): boolean {
  const limit = PLAN_CAPS[plan].geoRulesLimit;
  return limit === undefined || limit > 0;
}
