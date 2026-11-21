import {
  eventsUpgradeTarget,
  pricingHighlightHref,
} from "@/app/(main)/dashboard/_components/tracking-paused";
import EventUsageAlertEmail from "@/emails/event-usage-alert";
import { getAppUrl } from "@/lib/constants/domains";

import { sendEmail } from "./send-email";
import { productNotificationOptions } from "./unsubscribe";

import type { Plan } from "@/lib/billing/plans";

export type SendEventUsageEmailInput = {
  userId: string;
  email: string;
  name?: string | null;
  threshold: number;
  limit: number;
  currentCount: number;
  plan: Plan;
  /** When the monthly counter resets (first event of next month). */
  resetsAt: Date;
};

export function eventUsageSubject(threshold: number): string {
  return threshold >= 100
    ? "You've reached your monthly analytics cap"
    : `You're ${threshold}% through your monthly analytics cap`;
}

/**
 * The plan that raises the cap and a pricing link that preselects it. `source` and the UTM params
 * let upgrades be attributed to the 80% and 100% emails. Null for Ultra, which has no cap.
 */
export function eventUsageUpgrade(plan: Plan, threshold: number) {
  const target = eventsUpgradeTarget(plan);
  if (!target) return null;
  const path = pricingHighlightHref(target.plan, `events_email_${threshold}`, {
    utm_source: "ishortn",
    utm_medium: "email",
    utm_campaign: "event-cap",
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
  resetsAt,
}: SendEventUsageEmailInput) {
  const upgrade = eventUsageUpgrade(plan, threshold);
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
      notificationSettingsUrl,
    }),
    headers,
    context: { threshold, plan },
  });
}
