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
      upgradeUrl: getAppUrl("/dashboard/pricing"),
      notificationSettingsUrl,
    }),
    headers,
    context: { threshold, plan },
  });
}
