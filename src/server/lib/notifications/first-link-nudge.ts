import FirstLinkNudgeEmail from "@/emails/first-link-nudge";
import { getAppUrl } from "@/lib/constants/domains";

import { sendEmail } from "./send-email";
import { productNotificationOptions } from "./unsubscribe";

type SendFirstLinkNudgeEmailInput = {
  userId: string;
  email: string;
  name?: string | null;
};

const UTM = "utm_source=email&utm_medium=lifecycle&utm_campaign=first_link_nudge";

/** Returns whether Resend accepted the email. */
export function sendFirstLinkNudgeEmail({
  userId,
  email,
  name,
}: SendFirstLinkNudgeEmailInput): Promise<boolean> {
  const { notificationSettingsUrl, headers } = productNotificationOptions(userId);

  return sendEmail({
    template: "first-link-nudge",
    recipientId: userId,
    to: email,
    essential: false,
    subject: "Your first short link takes 10 seconds",
    react: FirstLinkNudgeEmail({
      userName: name,
      createLinkUrl: getAppUrl(`/dashboard/link/new?${UTM}`),
      createQrCodeUrl: getAppUrl(`/dashboard/qrcodes/create?${UTM}`),
      notificationSettingsUrl,
    }),
    headers,
  });
}
