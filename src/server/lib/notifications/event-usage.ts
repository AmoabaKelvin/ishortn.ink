import { promoBannerState } from "@/app/(main)/dashboard/_components/promo-banner-state";
import {
  eventsUpgradeTarget,
  pricingHighlightHref,
} from "@/app/(main)/dashboard/_components/tracking-paused";
import EventUsageAlertEmail from "@/emails/event-usage-alert";
import { getAppUrl } from "@/lib/constants/domains";

import { sendEmail } from "./send-email";
import { productNotificationOptions } from "./unsubscribe";

import type { Plan, SubscriptionMode } from "@/lib/billing/plans";
import type { Promo } from "@/lib/billing/promo";

export type SendEventUsageEmailInput = {
  userId: string;
  email: string;
  name?: string | null;
  threshold: number;
  limit: number;
  currentCount: number;
  plan: Plan;
  /** Whether upgrading starts a new checkout, the only path a promo discount applies to. */
  subscriptionMode: SubscriptionMode;
  /** When the monthly counter resets (first event of next month). */
  resetsAt: Date;
};

export function eventUsageSubject(threshold: number): string {
  return threshold >= 100
    ? "You've reached your monthly analytics cap"
    : `You're ${threshold}% through your monthly analytics cap`;
}

/** The running promo when this account's upgrade is a new Free-plan checkout, else null. */
export function eventUsagePromo(
  plan: Plan,
  subscriptionMode: SubscriptionMode,
  now = new Date(),
): Promo | null {
  return promoBannerState({
    subscription: { plan, isTeamWorkspace: false, subscriptionMode },
    otherBannerShown: false,
    now,
  });
}

/**
 * The plan that raises the cap and a pricing link that preselects it. `source` and the UTM params
 * let upgrades be attributed to the 80% and 100% emails, and to the promo while one runs. Null
 * for Ultra, which has no cap.
 */
export function eventUsageUpgrade(plan: Plan, threshold: number, promo: Promo | null = null) {
  const target = eventsUpgradeTarget(plan);
  if (!target) return null;
  const path = pricingHighlightHref(target.plan, `events_email_${threshold}`, {
    utm_source: "ishortn",
    utm_medium: "email",
    utm_campaign: promo?.utmCampaign ?? "event-cap",
  });
  return { plan: target.plan, label: target.label, url: getAppUrl(path) };
}

export async function sendEventUsageEmail({
  userId,
  email,
  name,
  threshold,
  limit,
  currentCount,
  plan,
  subscriptionMode,
  resetsAt,
}: SendEventUsageEmailInput) {
  const promo = eventUsagePromo(plan, subscriptionMode);
  const upgrade = eventUsageUpgrade(plan, threshold, promo);
  if (!upgrade) return;
  const { notificationSettingsUrl, headers } = productNotificationOptions(userId);

  await sendEmail({
    template: "event-usage-alert",
    recipientId: userId,
    to: email,
    essential: false,
    subject: eventUsageSubject(threshold),
    react: EventUsageAlertEmail({
      userName: name,
      threshold,
      limit,
      currentCount,
      plan,
      resetDate: resetsAt.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
      upgrade,
      promo,
      notificationSettingsUrl,
    }),
    headers,
    context: { threshold, plan, promo: promo?.code ?? null },
  });
}
