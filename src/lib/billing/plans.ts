import { addMonths } from "date-fns";

import type { Subscription } from "@/server/db/schema";

export type Plan = "free" | "pro" | "ultra";
export type BillingInterval = "monthly" | "annual";

type PlanCaps = {
  eventsLimit?: number; // undefined => unlimited
  linksLimit?: number;
  folderLimit?: number;
  analyticsRangeLimitDays?: number;
  domainLimit?: number;
  geoRulesLimit?: number; // Max targeting rules (geo/device/OS) per link (undefined => unlimited)
  milestonesPerLinkLimit?: number; // Max milestones per link (undefined => unlimited)
  bioPageLimit?: number; // Max bio pages (undefined => unlimited)
  bioLinkBlocksPerPageLimit?: number; // Max link blocks per bio page (undefined => unlimited)
  campaignLimit?: number; // Max ACTIVE campaigns (archived don't count; undefined => unlimited)
  qrCodeLimit?: number; // Max QR codes in the personal workspace (undefined => unlimited)
  bulkQrBatchLimit?: number; // Max QR codes created by one CSV import (0 => not available)
};

// Lemon Squeezy variant IDs per plan + billing interval.
// NOTE: these are hardcoded live IDs. The recommended hardening is to move them
// to env vars so Live/Test never drift (see billing follow-up).
const PRO_MONTHLY_VARIANT_ID = 1811616; // $8/mo — new signups
const PRO_LEGACY_MONTHLY_VARIANT_ID = 441105; // $5/mo — grandfathered subscribers
const PRO_ANNUAL_VARIANT_ID = 1809620;
const ULTRA_MONTHLY_VARIANT_ID = 1108002;
const ULTRA_ANNUAL_VARIANT_ID = 1809627;

// Recognition sets for getPlanFromIds (include legacy/test-mode variant ids).
const PRO_VARIANT_IDS = new Set([
  PRO_MONTHLY_VARIANT_ID,
  PRO_LEGACY_MONTHLY_VARIANT_ID,
  PRO_ANNUAL_VARIANT_ID,
  415248,
]);
const PRO_PRODUCT_IDS = new Set([441105, 306137]); // include known sample payload product_id
const ULTRA_VARIANT_IDS = new Set([ULTRA_MONTHLY_VARIANT_ID, ULTRA_ANNUAL_VARIANT_ID, 1134595]);
const ULTRA_PRODUCT_IDS = new Set([1108002]);

const ANNUAL_VARIANT_IDS = new Set([PRO_ANNUAL_VARIANT_ID, ULTRA_ANNUAL_VARIANT_ID]);

export const PLAN_VARIANT_IDS = {
  pro: { monthly: PRO_MONTHLY_VARIANT_ID, annual: PRO_ANNUAL_VARIANT_ID },
  ultra: { monthly: ULTRA_MONTHLY_VARIANT_ID, annual: ULTRA_ANNUAL_VARIANT_ID },
} satisfies Record<Exclude<Plan, "free">, Record<BillingInterval, number>>;

export function getVariantId(plan: Exclude<Plan, "free">, interval: BillingInterval): number {
  return PLAN_VARIANT_IDS[plan][interval];
}

export function isLegacyProVariant(variantId?: number | null): boolean {
  return variantId === PRO_LEGACY_MONTHLY_VARIANT_ID;
}

export function getIntervalFromVariantId(variantId?: number | null): BillingInterval {
  return variantId && ANNUAL_VARIANT_IDS.has(variantId) ? "annual" : "monthly";
}

type PlanCapsByPlan = { [P in Plan]: PlanCaps };

export const PLAN_CAPS: PlanCapsByPlan = {
  free: {
    eventsLimit: 1000,
    linksLimit: 30,
    folderLimit: 0,
    analyticsRangeLimitDays: 7,
    domainLimit: 0,
    geoRulesLimit: 0, // Targeting rules not available for free plan
    milestonesPerLinkLimit: 0,
    bioPageLimit: 1,
    bioLinkBlocksPerPageLimit: 3,
    campaignLimit: 1,
    qrCodeLimit: 5,
    bulkQrBatchLimit: 0,
  },
  pro: {
    eventsLimit: 10000,
    linksLimit: 1000,
    folderLimit: 5,
    domainLimit: 3,
    geoRulesLimit: 3, // Pro plan allows 3 targeting rules per link
    milestonesPerLinkLimit: 5,
    bioPageLimit: 3,
    campaignLimit: 2,
    bulkQrBatchLimit: 100,
  },
  ultra: {
    // unlimited
  },
};

export type ApiRateLimits = {
  perMinute: number;
  perDay: number;
};

// Requests to the key-authenticated /api/v1 endpoints, shared by all of an
// account's API keys (keys are free to mint, so a per-key budget would be no limit).
export const API_RATE_LIMITS = {
  free: { perMinute: 60, perDay: 1000 },
  pro: { perMinute: 300, perDay: 10000 },
  ultra: { perMinute: 1200, perDay: 100000 },
} satisfies Record<Plan, ApiRateLimits>;

export function getApiRateLimits(plan: Plan): ApiRateLimits {
  return API_RATE_LIMITS[plan];
}

export function getPlanFromIds(variantId?: number | null, productId?: number | null): Plan | null {
  if (variantId && ULTRA_VARIANT_IDS.has(variantId)) return "ultra";
  if (productId && ULTRA_PRODUCT_IDS.has(productId)) return "ultra";
  if (variantId && PRO_VARIANT_IDS.has(variantId)) return "pro";
  if (productId && PRO_PRODUCT_IDS.has(productId)) return "pro";
  return null;
}

// Lemon Squeezy statuses that grant paid access outright.
export const ENTITLED_SUBSCRIPTION_STATUSES = ["active", "on_trial", "past_due"];
const ENTITLED_STATUSES = new Set(ENTITLED_SUBSCRIPTION_STATUSES);

/**
 * Whether a subscription currently grants paid access. Honors the paid period:
 * active/on_trial/past_due are entitled, and a `cancelled` subscription stays
 * entitled until its `endsAt` passes (users keep access until the end of the
 * period they already paid for).
 */
export function isSubscriptionEntitled(
  subscription?: Subscription | null,
  nowMs = Date.now(),
): boolean {
  if (!subscription) return false;

  const status = subscription.status ?? "";
  if (ENTITLED_STATUSES.has(status)) return true;

  if (status === "cancelled" && subscription.endsAt) {
    return subscription.endsAt.getTime() > nowMs;
  }

  return false;
}

export function resolvePlan(subscription?: Subscription | null, nowMs = Date.now()): Plan {
  if (!subscription || !isSubscriptionEntitled(subscription, nowMs)) {
    return "free";
  }

  const mappedPlan =
    getPlanFromIds(subscription.variantId, subscription.productId) ?? subscription.plan;

  if (mappedPlan === "ultra" || mappedPlan === "pro") {
    return mappedPlan;
  }

  // Rows with no recognised variant and no stored paid plan (e.g. `plan: "free"`
  // with zeroed ids) carry no evidence of a paid subscription.
  return "free";
}

/**
 * How a plan change applies to a user's subscription:
 * - `checkout`: no paid subscription, so start a new hosted checkout.
 * - `update`: a live paid subscription, changed in place on Lemon Squeezy.
 * - `resume`: cancelled but still inside the paid period, or paused; it must be
 *   resumed rather than replaced, or the user would end up with two subscriptions.
 */
export type SubscriptionMode = "checkout" | "update" | "resume";

export function getSubscriptionMode(subscription?: Subscription | null): SubscriptionMode {
  if (!subscription?.subscriptionId || subscription.subscriptionId <= 0) return "checkout";
  // A paused subscription grants only Free access but still exists with the provider.
  if (subscription.status === "paused") return "resume";
  if (resolvePlan(subscription) === "free") return "checkout";

  return subscription.status === "cancelled" ? "resume" : "update";
}

export const PAUSE_MONTH_OPTIONS = [1, 2, 3] as const;

/**
 * Whether cancelling to Free first offers a billing pause. Only active monthly subscriptions:
 * an annual one is paid up for the year, so pausing invoices for a few months would only take
 * its paid features away.
 */
export function canOfferPause(
  subscription?: {
    status?: string | null;
    subscriptionId?: number | null;
    variantId?: number | null;
  } | null,
): boolean {
  return (
    !!subscription?.subscriptionId &&
    subscription.subscriptionId > 0 &&
    subscription.status === "active" &&
    getIntervalFromVariantId(subscription.variantId) === "monthly"
  );
}

/** When billing restarts for a pause of `months` starting at `now`. */
export function pauseResumesAt(months: number, now = new Date()): Date {
  return addMonths(now, months);
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

export function getMilestonesPerLinkLimit(plan: Plan): number | undefined {
  return PLAN_CAPS[plan].milestonesPerLinkLimit;
}

export function canUseMilestones(plan: Plan): boolean {
  const limit = PLAN_CAPS[plan].milestonesPerLinkLimit;
  return limit === undefined || limit > 0;
}

// ----------------------------------------------------------------------------
// Bio pages (link-in-bio)
// ----------------------------------------------------------------------------

export function getBioPageLimit(plan: Plan): number | undefined {
  return PLAN_CAPS[plan].bioPageLimit;
}

export function getBioLinkBlockLimit(plan: Plan): number | undefined {
  return PLAN_CAPS[plan].bioLinkBlocksPerPageLimit;
}

/** Pro+ may remove the "Made with iShortn" badge from their bio page. */
export function canRemoveBioBranding(plan: Plan): boolean {
  return plan !== "free";
}

/** Pro+ may customize bio-page themes beyond the curated presets. */
export function canUseBioCustomThemes(plan: Plan): boolean {
  return plan !== "free";
}

/** Pro+ may serve a bio page on a custom domain. */
export function canUseBioCustomDomain(plan: Plan): boolean {
  return plan !== "free";
}

/** Ultra-only: per-block UTM attribution on bio links. */
export function canUseBioUtmPerBlock(plan: Plan): boolean {
  return plan === "ultra";
}

/** Ultra-only: schedule bio blocks to reveal/hide at set times. */
export function canScheduleBioBlocks(plan: Plan): boolean {
  return plan === "ultra";
}

// ----------------------------------------------------------------------------
// Links
// ----------------------------------------------------------------------------

/** Pro+ may set UTM parameters on a link. Saved UTM templates stay Ultra-only. */
export function canUseLinkUtmParams(plan: Plan): boolean {
  return plan !== "free";
}

export const LINK_UTM_PLAN_MESSAGE =
  "UTM parameters are available on Pro and Ultra plans. Please upgrade to use this feature.";

// ----------------------------------------------------------------------------
// Campaigns
// ----------------------------------------------------------------------------

export function getCampaignLimit(plan: Plan): number | undefined {
  return PLAN_CAPS[plan].campaignLimit;
}

/** Pro+ campaigns carry UTM defaults stamped onto member links at save time. */
export function canUseCampaignUtmDefaults(plan: Plan): boolean {
  return plan !== "free";
}
