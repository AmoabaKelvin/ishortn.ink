import { pricingHighlightHref } from "@/app/(main)/dashboard/_components/tracking-paused";
import WeeklySummaryEmail, {
  formatClicks,
  type WeeklySummaryEmailProps,
} from "@/emails/weekly-summary";
import { env } from "@/env.mjs";
import { getAppUrl } from "@/lib/constants/domains";

import { sendEmail } from "./send-email";
import { buildUnsubscribeHeaders, NOTIFICATION_SETTINGS_PATH, unsubscribeUrl } from "./unsubscribe";

const UTM = {
  utm_source: "email",
  utm_medium: "lifecycle",
  utm_campaign: "weekly_summary",
};

export type WeeklySummaryContent = Pick<
  WeeklySummaryEmailProps,
  "weekLabel" | "clicks" | "previousClicks" | "topLinks" | "topCountry" | "topSource"
> & {
  /** Visits dropped this month while a Free account's tracking was paused, or null. */
  droppedClicks: number | null;
};

export type SendWeeklySummaryInput = {
  userId: string;
  email: string;
  name: string | null;
  content: WeeklySummaryContent;
};

export function weeklySummaryEmailProps(
  userId: string,
  name: string | null,
  { droppedClicks, ...content }: WeeklySummaryContent,
): WeeklySummaryEmailProps {
  return {
    ...content,
    userName: name,
    paused:
      droppedClicks === null
        ? null
        : {
            dropped: droppedClicks,
            upgradeUrl: getAppUrl(pricingHighlightHref("pro", "weekly_summary", UTM)),
          },
    analyticsUrl: getAppUrl(`/dashboard/analytics/overview?${new URLSearchParams(UTM).toString()}`),
    unsubscribeUrl: unsubscribeUrl(userId, env.EMAIL_UNSUBSCRIBE_SECRET, "weekly-summary"),
    notificationSettingsUrl: getAppUrl(NOTIFICATION_SETTINGS_PATH),
  };
}

/**
 * Returns whether Resend accepted the email. Sent from the lifecycle sender, never the
 * transactional one; the caller checks EMAIL_FROM_LIFECYCLE is set.
 */
export function sendWeeklySummaryEmail({
  userId,
  email,
  name,
  content,
}: SendWeeklySummaryInput): Promise<boolean> {
  return sendEmail({
    template: "weekly-summary",
    recipientId: userId,
    to: email,
    essential: false,
    from: env.EMAIL_FROM_LIFECYCLE,
    subject: `Your links got ${formatClicks(content.clicks)} last week`,
    react: WeeklySummaryEmail(weeklySummaryEmailProps(userId, name, content)),
    headers: buildUnsubscribeHeaders(userId, env.EMAIL_UNSUBSCRIBE_SECRET, "weekly-summary"),
  });
}
