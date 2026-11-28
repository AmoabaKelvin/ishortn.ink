import LinkMilestoneEmail from "@/emails/link-milestone";
import { getAppUrl } from "@/lib/constants/domains";

import { EMAIL_FROM_SYSTEM, sendEmail } from "./send-email";
import { productNotificationOptions } from "./unsubscribe";

type SendLinkMilestoneEmailInput = {
  userId: string;
  email: string;
  name?: string | null;
  linkAlias: string;
  linkDomain: string;
  linkName?: string | null;
  teamSlug: string | null;
  milestone: number;
  totalClicks: number;
};

export async function sendLinkMilestoneEmail({
  userId,
  email,
  name,
  linkAlias,
  linkDomain,
  linkName,
  teamSlug,
  milestone,
  totalClicks,
}: SendLinkMilestoneEmailInput) {
  const shortUrl = `${linkDomain}/${linkAlias}`;
  const { notificationSettingsUrl, headers } = productNotificationOptions(userId);
  const analyticsPath = `/dashboard/analytics/${encodeURIComponent(linkAlias)}?domain=${encodeURIComponent(linkDomain)}`;

  await sendEmail({
    template: "link-milestone",
    from: EMAIL_FROM_SYSTEM,
    recipientId: userId,
    to: email,
    essential: false,
    subject: `Your link "${linkName || shortUrl}" hit ${milestone.toLocaleString()} clicks`,
    react: LinkMilestoneEmail({
      userName: name,
      shortUrl,
      linkName,
      milestone,
      totalClicks,
      analyticsUrl: getAppUrl(analyticsPath, teamSlug),
      notificationSettingsUrl,
    }),
    headers,
    context: { linkAlias, milestone },
  });
}
