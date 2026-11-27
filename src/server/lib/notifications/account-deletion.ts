import AccountDeletionEmail from "@/emails/account-deletion";
import { getAppUrl } from "@/lib/constants/domains";

import { EMAIL_FROM_SYSTEM, sendEmail } from "./send-email";

type SendAccountDeletionEmailInput = {
  userId: string;
  toEmail?: string | null;
  toName?: string | null;
  purgeAt: Date;
};

export async function sendAccountDeletionEmail({
  userId,
  toEmail,
  toName,
  purgeAt,
}: SendAccountDeletionEmailInput) {
  if (!toEmail) return;

  await sendEmail({
    template: "account-deletion",
    from: EMAIL_FROM_SYSTEM,
    recipientId: userId,
    to: toEmail,
    essential: true,
    subject: "Your iShortn account is scheduled for deletion",
    react: AccountDeletionEmail({
      userName: toName,
      purgeDate: purgeAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      restoreUrl: getAppUrl("/dashboard"),
    }),
  });
}
