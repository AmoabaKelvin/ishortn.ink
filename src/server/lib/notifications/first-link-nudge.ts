import FirstLinkNudgeEmail from "@/emails/first-link-nudge";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { sendEmail } from "./send-email";
import { productNotificationOptions } from "./unsubscribe";

type SendFirstLinkNudgeEmailInput = {
  userId: string;
  email: string;
  name?: string | null;
};

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
      createLinkUrl: emailLinkUrl(EMAIL_LINKS.firstLinkNudge.createLink),
      createQrCodeUrl: emailLinkUrl(EMAIL_LINKS.firstLinkNudge.createQrCode),
      notificationSettingsUrl,
    }),
    headers,
  });
}
