import WeeklySummaryEmail, {
  weeklySummarySubject,
  type WeeklySummaryEmailProps,
  type WeeklySummaryUpgrade,
} from "@/emails/weekly-summary";
import { env } from "@/env.mjs";
import { getAppUrl } from "@/lib/constants/domains";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { EMAIL_FROM_SYSTEM, sendEmail, withSenderName } from "./send-email";
import { buildUnsubscribeHeaders, NOTIFICATION_SETTINGS_PATH, unsubscribeUrl } from "./unsubscribe";

export type WeeklySummaryContent = Pick<
  WeeklySummaryEmailProps,
  "weekLabel" | "clicks" | "previousClicks" | "topLinks" | "topCountry" | "topSource"
> & {
  /** The Free upgrade prompt, or null for paid accounts and Free accounts with nothing to say. */
  upgrade: WeeklySummaryUpgrade | null;
};

export type SendWeeklySummaryInput = {
  userId: string;
  email: string;
  content: WeeklySummaryContent;
};

export function weeklySummaryEmailProps(
  userId: string,
  { upgrade, ...content }: WeeklySummaryContent,
): WeeklySummaryEmailProps {
  return {
    ...content,
    upgrade: upgrade && {
      ...upgrade,
      upgradeUrl: emailLinkUrl(EMAIL_LINKS.weeklySummary.upgrade[upgrade.reason]),
    },
    analyticsUrl: emailLinkUrl(EMAIL_LINKS.weeklySummary.analytics),
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
  content,
}: SendWeeklySummaryInput): Promise<boolean> {
  return sendEmail({
    template: "weekly-summary",
    recipientId: userId,
    to: email,
    essential: false,
    from: env.EMAIL_FROM_LIFECYCLE && withSenderName(env.EMAIL_FROM_LIFECYCLE, EMAIL_FROM_SYSTEM),
    subject: weeklySummarySubject(content.clicks, content.previousClicks),
    react: WeeklySummaryEmail(weeklySummaryEmailProps(userId, content)),
    headers: buildUnsubscribeHeaders(userId, env.EMAIL_UNSUBSCRIBE_SECRET, "weekly-summary"),
  });
}
