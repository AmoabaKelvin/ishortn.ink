import LinkHealthAlertEmail, {
  linkHealthAlertSubject,
  type BrokenLinkItem,
} from "@/emails/link-health-alert";
import { env } from "@/env.mjs";

import { EMAIL_FROM_SYSTEM, sendEmail } from "./send-email";
import { productNotificationOptions, unsubscribeUrl } from "./unsubscribe";

/** Links listed in full; a longer outage list is summarised as "And N more". */
export const LINK_HEALTH_ALERT_MAX_LISTED = 20;

export type SendLinkHealthAlertInput = {
  userId: string;
  email: string;
  links: BrokenLinkItem[];
  dashboardUrl: string;
};

/** Returns whether Resend accepted the email. */
export function sendLinkHealthAlertEmail({
  userId,
  email,
  links,
  dashboardUrl,
}: SendLinkHealthAlertInput): Promise<boolean> {
  const listed = links.slice(0, LINK_HEALTH_ALERT_MAX_LISTED);
  const moreCount = links.length - listed.length;
  const { notificationSettingsUrl, headers } = productNotificationOptions(userId);

  return sendEmail({
    template: "link-health-alert",
    from: EMAIL_FROM_SYSTEM,
    recipientId: userId,
    to: email,
    essential: false,
    subject: linkHealthAlertSubject(listed, moreCount),
    react: LinkHealthAlertEmail({
      links: listed,
      moreCount,
      dashboardUrl,
      unsubscribeUrl: unsubscribeUrl(userId, env.EMAIL_UNSUBSCRIBE_SECRET),
      notificationSettingsUrl,
    }),
    headers,
    context: { links: links.length },
  });
}
