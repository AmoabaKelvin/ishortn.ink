import ApiAccessSunsetEmail from "@/emails/api-access-sunset";
import { API_UPGRADE_URL, formatSunsetDate } from "@/lib/billing/api-access";
import { logger } from "@/lib/logger";

import { resend } from "./resend-client";

const log = logger.child({ notification: "api-access-sunset" });

export type ApiSunsetRecipient = {
  email: string;
  name: string | null;
  sunsetAt: Date;
};

/** Resend's batch endpoint takes up to 100 emails per call. */
export const API_SUNSET_EMAIL_BATCH_SIZE = 100;

/**
 * Sends one email per recipient in a single batch call. Returns false when
 * the batch was not accepted, so the caller can retry those accounts later.
 */
export async function sendApiSunsetEmails(
  recipients: ApiSunsetRecipient[],
  kind: "notice" | "reminder",
): Promise<boolean> {
  if (!recipients.length) return true;
  if (!resend) {
    log.warn({ count: recipients.length, kind }, "RESEND_API_KEY unset; skipping sunset emails");
    return false;
  }

  const upgradeUrl = `${API_UPGRADE_URL}?utm_source=email&utm_medium=transactional&utm_campaign=api-access-sunset`;
  const subject =
    kind === "reminder"
      ? "Your iShortn API key stops working tomorrow"
      : "iShortn API access is moving to Pro";

  try {
    const { error } = await resend.batch.send(
      recipients.map((recipient) => ({
        from: "Kelvin from iShortn <kelvin@ishortn.ink>",
        to: recipient.email,
        subject,
        react: ApiAccessSunsetEmail({
          userName: recipient.name,
          sunsetDate: formatSunsetDate(recipient.sunsetAt),
          upgradeUrl,
          kind,
        }),
      })),
    );
    if (error) {
      log.error({ err: error, count: recipients.length, kind }, "sunset email batch rejected");
      return false;
    }
    return true;
  } catch (error) {
    log.error({ err: error, count: recipients.length, kind }, "failed to send sunset emails");
    return false;
  }
}
