import { getPlanFromIds, resolvePlan } from "./plans";

import type { Plan } from "./plans";
import type { Subscription } from "@/server/db/schema";

export const API_UPGRADE_URL = "https://ishortn.ink/pricing";

/** How long keys keep working once their account is not on Pro or Ultra. */
export const API_ACCESS_NOTICE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * - `full`: Pro or Ultra.
 * - `sunsetting`: not on a paid plan; keys work on Free limits until `sunsetAt`.
 * - `revoked`: not on a paid plan and past `sunsetAt`.
 */
export type ApiAccess =
  | { status: "full" }
  | { status: "sunsetting"; deprecatedAt: Date; sunsetAt: Date }
  | { status: "revoked"; sunsetAt: Date };

/** API access (creating keys and using them) is part of Pro and Ultra. */
export function canUseApi(plan: Plan): boolean {
  return plan !== "free";
}

/**
 * When API keys on accounts without Pro or Ultra stop working: release day
 * plus API_ACCESS_NOTICE_DAYS. Committed rather than a Worker variable so every
 * deploy carries it; a missing value would silently restore Free API access.
 */
export const API_FREE_ACCESS_SUNSET_AT = new Date("2026-11-28T12:00:00Z");

// Statuses a real provider subscription ends in once it stops being paid.
const LAPSED_STATUSES = new Set(["cancelled", "expired", "unpaid", "paused"]);

/**
 * When a subscription that used to grant a paid plan stopped doing so: the
 * end of the paid period, else the provider's last update. Null for accounts
 * that never paid or are still entitled.
 */
function lapsedAt(subscription: Subscription | null, nowMs: number): Date | null {
  if (!subscription || resolvePlan(subscription, nowMs) !== "free") return null;
  // The webhook zeroes plan, variantId and productId when a subscription ends
  // (subscription_expired and friends), so the provider subscription id and a
  // terminal status are the evidence that survives a lapse.
  const wasPaid =
    ((subscription.subscriptionId ?? 0) > 0 && LAPSED_STATUSES.has(subscription.status ?? "")) ||
    getPlanFromIds(subscription.variantId, subscription.productId) !== null ||
    subscription.plan === "pro" ||
    subscription.plan === "ultra";
  if (!wasPaid) return null;
  return subscription.endsAt ?? subscription.providerUpdatedAt ?? null;
}

/**
 * Whether an account's API keys work at `now`. Accounts without a paid plan
 * keep working until the configured cutoff; an account whose paid plan lapsed
 * gets the same notice period counted from the lapse when that ends later.
 */
export function getApiAccess(
  subscription: Subscription | null,
  configuredSunset: Date,
  now: Date,
): ApiAccess {
  const nowMs = now.getTime();
  if (canUseApi(resolvePlan(subscription, nowMs))) return { status: "full" };

  const lapse = lapsedAt(subscription, nowMs);
  const sunsetMs = Math.max(
    configuredSunset.getTime(),
    lapse ? lapse.getTime() + API_ACCESS_NOTICE_DAYS * DAY_MS : 0,
  );
  const sunsetAt = new Date(sunsetMs);

  if (nowMs >= sunsetMs) return { status: "revoked", sunsetAt };
  return {
    status: "sunsetting",
    deprecatedAt: new Date(sunsetMs - API_ACCESS_NOTICE_DAYS * DAY_MS),
    sunsetAt,
  };
}

export function formatSunsetDate(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function apiSunsetWarning(sunsetAt: Date): string {
  return `API access requires a Pro or Ultra plan. This API key stops working on ${formatSunsetDate(sunsetAt)}. Upgrade at ${API_UPGRADE_URL} to keep using the API.`;
}
