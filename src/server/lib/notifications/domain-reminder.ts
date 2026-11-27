import DomainReminderEmail from "@/emails/domain-reminder";
import { getAppUrl } from "@/lib/constants/domains";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { EMAIL_FROM_SYSTEM, sendEmail } from "./send-email";
import { productNotificationOptions } from "./unsubscribe";

type Challenge = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
};

type SendDomainReminderEmailInput = {
  userId: string;
  email: string;
  recipientName?: string | null;
  domain: string;
  teamSlug: string | null;
  daysMisconfigured: number;
  challenges: Challenge[];
};

/** Resolves to whether the reminder was sent, so the caller only throttles delivered ones. */
export function sendDomainReminderEmail({
  userId,
  email,
  recipientName,
  domain,
  teamSlug,
  daysMisconfigured,
  challenges,
}: SendDomainReminderEmailInput): Promise<boolean> {
  const { notificationSettingsUrl, headers } = productNotificationOptions(userId);

  return sendEmail({
    template: "domain-reminder",
    from: EMAIL_FROM_SYSTEM,
    recipientId: userId,
    to: email,
    essential: false,
    subject: `${domain} needs configuration on iShortn`,
    react: DomainReminderEmail({
      recipientName,
      domain,
      daysMisconfigured,
      challenges,
      // Team domains live on the team's subdomain, which a fixed short link can't point at.
      dashboardUrl: teamSlug
        ? getAppUrl("/dashboard/domains", teamSlug)
        : emailLinkUrl(EMAIL_LINKS.domainReminder.domains),
      notificationSettingsUrl,
    }),
    headers,
    context: { domain, daysMisconfigured },
  });
}
