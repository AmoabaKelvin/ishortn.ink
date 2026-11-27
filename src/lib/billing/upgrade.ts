import type { Plan, SubscriptionMode } from "./plans";
import type { Promo } from "./promo";

export type UpgradePlan = Exclude<Plan, "free">;

const UPGRADE_PLAN_NAMES = { pro: "Pro", ultra: "Ultra" } satisfies Record<UpgradePlan, string>;

/**
 * Where every upgrade prompt leads: the pricing page with the plan that removes the limit.
 * Prompts that showed a promo offer add campaign UTMs so their checkouts attribute to it.
 */
export function buildUpgradeUrl(
  requiredPlan: UpgradePlan,
  source: string,
  promo?: Promo | null,
): string {
  const params = new URLSearchParams({ highlight: requiredPlan, source });
  if (promo) {
    params.set("utm_source", "app");
    params.set("utm_medium", "upgrade_prompt");
    params.set("utm_campaign", promo.utmCampaign);
    params.set("utm_content", source);
  }
  return `/dashboard/pricing?${params.toString()}`;
}

/** The next plan up, for limits that apply on every plan below Ultra (Pro caps lift on Ultra). */
export function nextPlanFor(plan: Plan): UpgradePlan {
  return plan === "free" ? "pro" : "ultra";
}

// Reason line shown above the pricing cards, keyed by upgrade source. `{plan}`
// becomes the highlighted plan's name. Unknown sources show no line.
const UPGRADE_REASONS = new Map(
  Object.entries({
    analytics_export: "Exporting clicks to CSV is on {plan}",
    analytics_range: "Your full analytics history is on {plan}",
    api_access: "API access is on {plan}",
    bio_branding: "Removing iShortn branding is on {plan}",
    bio_custom_domain: "Custom domains for bio pages are on {plan}",
    bio_link_block_limit: "More link blocks per bio page are on {plan}",
    bio_page_limit: "More bio pages are on {plan}",
    bio_scheduled_blocks: "Scheduled bio blocks are on {plan}",
    bio_theme: "Theme customization is on {plan}",
    bulk_import: "Bulk link import is on {plan}",
    campaign_create: "More active campaigns are on {plan}",
    campaign_unarchive: "More active campaigns are on {plan}",
    campaign_utm_defaults: "Campaign UTM defaults are on {plan}",
    custom_domain: "Custom domains are on {plan}",
    first_link_own_domain: "Custom domains are on {plan}",
    folder_create: "More folders are on {plan}",
    folder_move: "Folders are on {plan}",
    folders: "Folders are on {plan}",
    geo_rules: "Targeting rules are on {plan}",
    link_create: "More links each month are on {plan}",
    link_password: "Password-protected links are on {plan}",
    link_ready: "Custom domains and full click history are on {plan}",
    link_schedule: "Scheduled links are on {plan}",
    milestones: "Click milestone notifications are on {plan}",
    qr_create_limit: "More QR codes are on {plan}",
    qr_limit: "More QR codes are on {plan}",
    teams: "Teams are on {plan}",
    utm_templates: "UTM templates are on {plan}",
  }),
);

export function getUpgradeReason(source: string | null | undefined, plan: UpgradePlan) {
  // A Map, not an object lookup: `source` comes from the URL, so "toString" & co. must not match.
  const template = source ? UPGRADE_REASONS.get(source) : undefined;
  return template?.replace("{plan}", UPGRADE_PLAN_NAMES[plan]) ?? null;
}

/**
 * The plan card to preselect from `?highlight=`, or null when the value is not
 * a paid plan above the current one. Highlighting never starts a checkout.
 */
export function resolveHighlightPlan(
  highlight: string | null | undefined,
  currentPlan: Plan,
): UpgradePlan | null {
  if (highlight !== "pro" && highlight !== "ultra") return null;
  if (currentPlan === "ultra" || (currentPlan === "pro" && highlight === "pro")) return null;
  return highlight;
}

const PLAN_ORDER = { free: 0, pro: 1, ultra: 2 } satisfies Record<Plan, number>;

/**
 * The plan to start upgrading to on arrival, from `?plan=` only (set right
 * after signup). `?highlight=` from in-app upgrade prompts never starts one.
 */
export function resolveAutoUpgradePlan(
  searchParams: Pick<URLSearchParams, "get"> | null,
  currentPlan: Plan,
  subscriptionMode: SubscriptionMode,
): UpgradePlan | null {
  const plan = searchParams?.get("plan");
  if (plan !== "pro" && plan !== "ultra") return null;
  if (subscriptionMode === "resume" || PLAN_ORDER[plan] <= PLAN_ORDER[currentPlan]) return null;
  return plan;
}

/**
 * Query string for the pricing page entry a hosted checkout returns to on Back: `?plan=` and
 * `?interval=` dropped so it never starts another checkout, the plan kept preselected.
 */
export function checkoutReturnSearch(search: string, plan: UpgradePlan): string {
  const params = new URLSearchParams(search);
  params.delete("plan");
  params.delete("interval");
  params.set("highlight", plan);
  return `?${params.toString()}`;
}
