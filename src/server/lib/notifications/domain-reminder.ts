import DomainReminderEmail from "@/emails/domain-reminder";
import { getAppUrl } from "@/lib/constants/domains";

import { sendEmail } from "./send-email";
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
    recipientId: userId,
    to: email,
    subject: `${domain} needs configuration on iShortn`,
    react: DomainReminderEmail({
      recipientName,
      domain,
      daysMisconfigured,
      challenges,
      dashboardUrl: getAppUrl("/dashboard/domains", teamSlug),
      notificationSettingsUrl,
    }),
    headers,
    context: { domain, daysMisconfigured },
  });
}
