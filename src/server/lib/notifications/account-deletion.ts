import AccountDeletionEmail from "@/emails/account-deletion";
import { getAppBaseDomain } from "@/lib/constants/domains";
import { logger } from "@/lib/logger";

import { resend } from "./resend-client";

const log = logger.child({ notification: "account-deletion" });

type SendAccountDeletionEmailInput = {
  toEmail?: string | null;
  toName?: string | null;
  purgeAt: Date;
};

/**
 * Confirms the soft delete and carries the restore link — also the only signal
 * a user gets if someone else deleted their account.
 */
export async function sendAccountDeletionEmail({
  toEmail,
  toName,
  purgeAt,
}: SendAccountDeletionEmailInput) {
  if (!resend || !toEmail) return;

  try {
    await resend.emails.send({
      from: "Kelvin from iShortn <kelvin@ishortn.ink>",
      to: toEmail,
      subject: "Your iShortn account is scheduled for deletion",
      react: AccountDeletionEmail({
        userName: toName,
        purgeDate: purgeAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        restoreUrl: `https://${getAppBaseDomain()}/dashboard`,
      }),
    });
  } catch (error) {
    log.error({ err: error, toEmail }, "failed to send account deletion email");
  }
}
