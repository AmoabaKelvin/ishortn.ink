import { APP_BASE_DOMAIN } from "@/lib/constants/domains";

import { effectivePlan } from "./entitlements";
import { getPlanFromIds, hasProviderSubscription } from "./plans";

import type { PlanGrace } from "./entitlements";
import type { Plan } from "./plans";
import type { Subscription } from "@/server/db/schema";

export const API_UPGRADE_URL = `https://${APP_BASE_DOMAIN}/pricing`;

/** How long keys keep working once their account is not on Pro or Ultra. */
export const API_ACCESS_NOTICE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * - `full`: paid plan, or the Free cutoff hasn't been set yet.
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
 * Parses a sunset override (`API_FREE_ACCESS_SUNSET_AT`, tests only).
 * Returns null when unset or unparseable.
 */
export function parseApiSunset(value: string | undefined | null): Date | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * When an account that is no longer entitled to a paid plan lost it: the end
 * of its paid-plan grace period when one was granted, else the end of the
 * paid period, else the provider's last update. Null for accounts that never
 * paid. Only checkout-created rows carry a provider subscription id; the plan
 * and variant can't be used here because the webhook resets them to free/0
 * on `subscription_expired`.
 */
function lapsedAt(subscription: Subscription | null, grace: PlanGrace): Date | null {
  const graceEnd =
    grace.planGracePlan && grace.planGracePlan !== "free" ? grace.planGraceEndsAt : null;
  const wasPaid =
    !!subscription &&
    (hasProviderSubscription(subscription) ||
      getPlanFromIds(subscription.variantId, subscription.productId) !== null ||
      subscription.plan === "pro" ||
      subscription.plan === "ultra");
  const subscriptionEnd = wasPaid
    ? (subscription.endsAt ?? subscription.providerUpdatedAt ?? null)
    : null;
  if (!graceEnd) return subscriptionEnd;
  if (!subscriptionEnd) return graceEnd;
  return graceEnd > subscriptionEnd ? graceEnd : subscriptionEnd;
}

/**
 * Whether an account's API keys work at `now`. The plan is the account's live
 * entitlement (`effectivePlan`), so a plan grace period keeps the API too.
 * Accounts without a paid plan keep working until the stored cutoff
 * (`configuredSunset`, null until the first sunset cron run sets it); an
 * account whose paid plan lapsed gets the same notice period counted from the
 * lapse when that ends later.
 */
export function getApiAccess(
  subscription: Subscription | null,
  grace: PlanGrace,
  configuredSunset: Date | null,
  now: Date,
): ApiAccess {
  const nowMs = now.getTime();
  if (canUseApi(effectivePlan(subscription, grace, now)) || !configuredSunset) {
    return { status: "full" };
  }

  const lapse = lapsedAt(subscription, grace);
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
