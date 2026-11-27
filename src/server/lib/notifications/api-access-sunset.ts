import ApiAccessSunsetEmail from "@/emails/api-access-sunset";
import { formatSunsetDate } from "@/lib/billing/api-access";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";
import { logger } from "@/lib/logger";

import { getResend } from "./resend-client";
import { EMAIL_FROM, withReplyTo } from "./send-email";

const log = logger.child({ notification: "api-access-sunset" });

export type ApiSunsetEmailKind = "notice" | "reminder";

export type ApiSunsetRecipient = {
  userId: string;
  email: string;
  name: string | null;
  sunsetAt: Date;
  kind: ApiSunsetEmailKind;
};

/** Resend's batch endpoint takes up to 100 emails per call. */
export const API_SUNSET_EMAIL_BATCH_SIZE = 100;

function toEmail(recipient: ApiSunsetRecipient) {
  return withReplyTo({
    from: EMAIL_FROM,
    to: recipient.email,
    subject:
      recipient.kind === "reminder"
        ? "Your iShortn API key stops working tomorrow"
        : "iShortn API access is moving to Pro",
    react: ApiAccessSunsetEmail({
      userName: recipient.name,
      sunsetDate: formatSunsetDate(recipient.sunsetAt),
      upgradeUrl: emailLinkUrl(EMAIL_LINKS.apiAccessSunset.pricing),
      kind: recipient.kind,
    }),
  });
}

/**
 * Sends one email per recipient and returns the ids of the users whose email
 * was accepted, so the caller marks only those and retries the rest later.
 * Resend validates a batch as a whole, so a rejected batch is retried one
 * email at a time to keep one bad address from blocking everyone else.
 */
export async function sendApiSunsetEmails(recipients: ApiSunsetRecipient[]): Promise<string[]> {
  if (!recipients.length) return [];
  const client = await getResend();
  if (!client) {
    log.warn({ count: recipients.length }, "RESEND_API_KEY unset; skipping sunset emails");
    return [];
  }

  try {
    const { error } = await client.batch.send(recipients.map(toEmail));
    if (!error) return recipients.map((recipient) => recipient.userId);
    log.warn(
      { err: error, count: recipients.length },
      "sunset email batch rejected; sending singly",
    );
  } catch (error) {
    log.warn({ err: error, count: recipients.length }, "sunset email batch failed; sending singly");
  }

  const sent: string[] = [];
  for (const recipient of recipients) {
    try {
      const { error } = await client.emails.send(toEmail(recipient));
      if (error) {
        log.error({ err: error, userId: recipient.userId }, "sunset email rejected");
      } else {
        sent.push(recipient.userId);
      }
    } catch (error) {
      log.error({ err: error, userId: recipient.userId }, "failed to send sunset email");
    }
  }
  return sent;
}
