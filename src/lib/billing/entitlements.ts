import { getPlanCaps, getPlanFromIds } from "@/lib/billing/plans";

import type { Plan } from "@/lib/billing/plans";
import type { Subscription } from "@/server/db/schema";

/**
 * Plan entitlements, derived from live subscription status plus a grace period.
 *
 * - `paidPlan`: what the subscription pays for right now. active/on_trial count;
 *   a cancelled subscription counts until `endsAt`; everything else is free.
 * - Grace: when access lapses (expiry, failed payment, refund) or an account is
 *   found using features above its plan, it keeps `planGracePlan` for
 *   GRACE_PERIOD_DAYS. After that the paid plan's limits apply. The grace row is
 *   kept once it passes, so a second one is never granted for the same lapse;
 *   it is cleared when the paid plan covers it again (resubscribing).
 * - Teams take the owner's plan. An owner below Ultra gets a team grace period,
 *   after which the workspace is read-only.
 */

export const GRACE_PERIOD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
export const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * DAY_MS;

const PLAN_RANK = { free: 0, pro: 1, ultra: 2 } satisfies Record<Plan, number>;

export const PLAN_NAMES = { free: "Free", pro: "Pro", ultra: "Ultra" } satisfies Record<
  Plan,
  string
>;

export function planAtLeast(plan: Plan, minimum: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minimum];
}

export function higherPlan(a: Plan, b: Plan): Plan {
  return PLAN_RANK[a] >= PLAN_RANK[b] ? a : b;
}

type SubscriptionState = Pick<
  Subscription,
  "status" | "endsAt" | "variantId" | "productId" | "plan"
> | null;

/** The paid plan a subscription is for, whatever its status. */
export function subscribedPlan(subscription?: SubscriptionState): Plan {
  if (!subscription) return "free";
  const plan = getPlanFromIds(subscription.variantId, subscription.productId) ?? subscription.plan;
  return plan === "pro" || plan === "ultra" ? plan : "free";
}

/** The plan the subscription is paying for right now, ignoring any grace period. */
export function paidPlan(subscription?: SubscriptionState, now = new Date()): Plan {
  if (!subscription) return "free";
  const status = subscription.status ?? "";
  if (status === "active" || status === "on_trial") return subscribedPlan(subscription);
  if (status === "cancelled" && subscription.endsAt && subscription.endsAt > now) {
    return subscribedPlan(subscription);
  }
  return "free";
}

export type PlanGrace = {
  planGracePlan: Plan | null;
  planGraceEndsAt: Date | null;
};

export const NO_GRACE: PlanGrace = { planGracePlan: null, planGraceEndsAt: null };

export function isGraceActive(endsAt: Date | null | undefined, now = new Date()): boolean {
  return !!endsAt && endsAt > now;
}

/** The plan an account may use right now: the paid plan, or its grace plan while that lasts. */
export function effectivePlan(
  subscription: SubscriptionState | undefined,
  grace: PlanGrace,
  now = new Date(),
): Plan {
  let plan = paidPlan(subscription, now);
  // A failed renewal keeps the subscribed plan until its grace period is recorded
  // (by the webhook, or the daily reconcile if that was missed); from then on the
  // grace period decides.
  if (subscription?.status === "past_due" && !grace.planGraceEndsAt) {
    plan = higherPlan(plan, subscribedPlan(subscription));
  }
  if (grace.planGracePlan && isGraceActive(grace.planGraceEndsAt, now)) {
    plan = higherPlan(plan, grace.planGracePlan);
  }
  return plan;
}

/** Subscription statuses where access ended without the customer choosing another plan. */
export function isLapsedStatus(status: string | null | undefined): boolean {
  return status !== "active" && status !== "on_trial";
}

export type GraceChange =
  | { type: "none" }
  | { type: "clear" }
  | { type: "start"; plan: Plan; endsAt: Date };

/**
 * What a subscription change does to the account's grace period. `before` is the
 * effective plan under the previous subscription state. Access that drops because
 * the subscription lapsed starts a grace period at the old plan; a paid plan that
 * covers the grace plan again clears it.
 */
export function graceChangeAfterBillingEvent(input: {
  before: Plan;
  subscription: SubscriptionState;
  grace: PlanGrace;
  now?: Date;
}): GraceChange {
  const now = input.now ?? new Date();
  const after = paidPlan(input.subscription, now);
  const { planGracePlan, planGraceEndsAt } = input.grace;

  if (planGraceEndsAt && planAtLeast(after, planGracePlan ?? "free")) return { type: "clear" };

  const lapsed = isLapsedStatus(input.subscription?.status) && !planAtLeast(after, input.before);
  if (lapsed && !isGraceActive(planGraceEndsAt, now)) {
    return { type: "start", plan: input.before, endsAt: new Date(now.getTime() + GRACE_PERIOD_MS) };
  }

  return { type: "none" };
}

// ----------------------------------------------------------------------------
// Teams
// ----------------------------------------------------------------------------

export type TeamAccess = {
  plan: Plan;
  readOnly: boolean;
  /** End of the owner-plan grace period while one applies. */
  graceEndsAt: Date | null;
};

/**
 * Teams are an Ultra feature, so a team has Ultra entitlements while its owner
 * does. Otherwise it keeps them through the team grace period and becomes
 * read-only afterwards. A team with no grace recorded yet stays writable until
 * the webhook or daily reconcile records one, so nothing locks without notice.
 */
export function teamAccess(
  ownerPlan: Plan,
  teamGraceEndsAt: Date | null,
  now = new Date(),
): TeamAccess {
  if (ownerPlan === "ultra") return { plan: "ultra", readOnly: false, graceEndsAt: null };
  if (!teamGraceEndsAt || isGraceActive(teamGraceEndsAt, now)) {
    return { plan: "ultra", readOnly: false, graceEndsAt: teamGraceEndsAt };
  }
  return { plan: ownerPlan, readOnly: true, graceEndsAt: teamGraceEndsAt };
}

export const TEAM_READ_ONLY_MESSAGE =
  "The workspace owner needs Ultra. This workspace is read-only until they upgrade.";

// ----------------------------------------------------------------------------
// Feature usage above a plan
// ----------------------------------------------------------------------------

/**
 * What a personal workspace uses of each paid feature: counts, or a per-item
 * maximum. Teams are covered by the team grace period instead.
 */
export type PlanUsage = {
  customDomains: number;
  folders: number;
  bioPages: number;
  maxLinkBlocksPerBioPage: number;
  bioPagesWithPaidOptions: number;
  activeCampaigns: number;
  qrCodes: number;
  maxTargetingRulesPerLink: number;
  maxMilestonesPerLink: number;
  passwordLinks: number;
  scheduledLinks: number;
  verifiedClickLinks: number;
  utmLinks: number;
  cloakedLinks: number;
};

export type UsageFeature = keyof PlanUsage;

export const EMPTY_USAGE: PlanUsage = {
  customDomains: 0,
  folders: 0,
  bioPages: 0,
  maxLinkBlocksPerBioPage: 0,
  bioPagesWithPaidOptions: 0,
  activeCampaigns: 0,
  qrCodes: 0,
  maxTargetingRulesPerLink: 0,
  maxMilestonesPerLink: 0,
  passwordLinks: 0,
  scheduledLinks: 0,
  verifiedClickLinks: 0,
  utmLinks: 0,
  cloakedLinks: 0,
};

// Mirrors FREE_QR_CODE_LIMIT in qrcode.service.ts.
export const FREE_QR_CODE_LIMIT = 5;

const PLANS: Plan[] = ["free", "pro", "ultra"];

/** Feature allowance per plan; undefined means unlimited. */
const FEATURE_LIMITS = {
  customDomains: (plan) => getPlanCaps(plan).domainLimit,
  folders: (plan) => getPlanCaps(plan).folderLimit,
  bioPages: (plan) => getPlanCaps(plan).bioPageLimit,
  maxLinkBlocksPerBioPage: (plan) => getPlanCaps(plan).bioLinkBlocksPerPageLimit,
  bioPagesWithPaidOptions: (plan) => (plan === "free" ? 0 : undefined),
  activeCampaigns: (plan) => getPlanCaps(plan).campaignLimit,
  qrCodes: (plan) => (plan === "free" ? FREE_QR_CODE_LIMIT : undefined),
  maxTargetingRulesPerLink: (plan) => getPlanCaps(plan).geoRulesLimit,
  maxMilestonesPerLink: (plan) => getPlanCaps(plan).milestonesPerLinkLimit,
  passwordLinks: (plan) => (plan === "free" ? 0 : undefined),
  scheduledLinks: (plan) => (plan === "free" ? 0 : undefined),
  verifiedClickLinks: (plan) => (plan === "free" ? 0 : undefined),
  utmLinks: (plan) => (plan === "ultra" ? undefined : 0),
  cloakedLinks: (plan) => (plan === "ultra" ? undefined : 0),
} satisfies Record<UsageFeature, (plan: Plan) => number | undefined>;

export const FEATURE_LABELS = {
  customDomains: "Custom domains",
  folders: "Folders",
  bioPages: "Bio pages",
  maxLinkBlocksPerBioPage: "Link blocks on a bio page",
  bioPagesWithPaidOptions: "Bio pages with a custom domain or no branding",
  activeCampaigns: "Active campaigns",
  qrCodes: "QR codes",
  maxTargetingRulesPerLink: "Targeting rules on a link",
  maxMilestonesPerLink: "Click milestones on a link",
  passwordLinks: "Password-protected links",
  scheduledLinks: "Scheduled links",
  verifiedClickLinks: "Links with verified clicks",
  utmLinks: "Links with UTM parameters",
  cloakedLinks: "Cloaked links",
} satisfies Record<UsageFeature, string>;

/** The lowest plan whose allowance covers `amount` of a feature. */
export function planForFeature(feature: UsageFeature, amount: number): Plan {
  for (const plan of PLANS) {
    const limit = FEATURE_LIMITS[feature](plan);
    if (limit === undefined || amount <= limit) return plan;
  }
  return "ultra";
}

export type OverPlanFeature = {
  feature: UsageFeature;
  label: string;
  amount: number;
  limit: number;
  requiredPlan: Plan;
};

/** Features used beyond what `plan` allows, with the plan that covers each. */
export function overPlanFeatures(usage: PlanUsage, plan: Plan): OverPlanFeature[] {
  const over: OverPlanFeature[] = [];
  // SAFETY: FEATURE_LIMITS is checked to have exactly the UsageFeature keys.
  for (const feature of Object.keys(FEATURE_LIMITS) as UsageFeature[]) {
    const limit = FEATURE_LIMITS[feature](plan);
    const amount = usage[feature];
    if (limit === undefined || amount <= limit) continue;
    over.push({
      feature,
      label: FEATURE_LABELS[feature],
      amount,
      limit,
      requiredPlan: planForFeature(feature, amount),
    });
  }
  return over;
}

const PER_ITEM_FEATURES = new Set<UsageFeature>([
  "maxLinkBlocksPerBioPage",
  "maxTargetingRulesPerLink",
  "maxMilestonesPerLink",
]);

/** One line for emails: what is used, and what the plan named `planName` allows. */
export function describeOverPlanFeature(item: OverPlanFeature, planName: string): string {
  const amount = PER_ITEM_FEATURES.has(item.feature)
    ? `up to ${item.amount.toLocaleString()}`
    : item.amount.toLocaleString();
  const allowance =
    item.limit === 0 ? `not included in ${planName}` : `${planName} includes ${item.limit}`;
  return `${item.label}: ${amount} (${allowance})`;
}

/** The lowest plan that covers everything in `usage`. */
export function requiredPlanForUsage(usage: PlanUsage): Plan {
  return overPlanFeatures(usage, "free").reduce<Plan>(
    (plan, item) => higherPlan(plan, item.requiredPlan),
    "free",
  );
}

// ----------------------------------------------------------------------------
// Grace emails
// ----------------------------------------------------------------------------

export type GraceReason = "lapsed" | "over_plan";

/** Email stages, stored as the last stage sent. */
export const GRACE_EMAIL_STAGE = { none: 0, started: 1, reminder: 2, ended: 3 } as const;
export type GraceEmailKind = "started" | "reminder" | "ended";

/**
 * The next grace email due, if any. Lapsed subscriptions are emailed on day 0,
 * day 5 and day 7; accounts found over their plan (and teams) on day 0 and 24
 * hours before the grace period ends.
 */
export function dueGraceEmail(input: {
  reason: GraceReason;
  endsAt: Date;
  stage: number;
  now?: Date;
}): GraceEmailKind | null {
  const now = input.now ?? new Date();
  const { reason, endsAt, stage } = input;
  const reminderLeadMs = reason === "lapsed" ? 2 * DAY_MS : DAY_MS;

  if (stage < GRACE_EMAIL_STAGE.started) {
    // Never send a "your grace period started" email after it has already ended.
    return now < endsAt ? "started" : null;
  }
  if (reason === "lapsed" && now >= endsAt) {
    return stage < GRACE_EMAIL_STAGE.ended ? "ended" : null;
  }
  if (
    stage < GRACE_EMAIL_STAGE.reminder &&
    now < endsAt &&
    endsAt.getTime() - now.getTime() <= reminderLeadMs
  ) {
    return "reminder";
  }
  return null;
}
