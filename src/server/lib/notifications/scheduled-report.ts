import ScheduledReportEmail, {
  scheduledReportSubject,
  type ScheduledReportEmailProps,
} from "@/emails/scheduled-report";
import { env } from "@/env.mjs";

import { EMAIL_FROM_SYSTEM, sendEmail } from "./send-email";
import { buildUnsubscribeHeaders, scheduledReportRecipientId, unsubscribeUrl } from "./unsubscribe";

export type ScheduledReportContent = Omit<ScheduledReportEmailProps, "unsubscribeUrl">;

export type SendScheduledReportInput = {
  reportId: number;
  email: string;
  content: ScheduledReportContent;
};

export function scheduledReportEmailProps(
  reportId: number,
  email: string,
  content: ScheduledReportContent,
): ScheduledReportEmailProps {
  const recipientId = scheduledReportRecipientId(reportId, email);
  return {
    ...content,
    unsubscribeUrl: unsubscribeUrl(recipientId, env.EMAIL_UNSUBSCRIBE_SECRET, "scheduled-report"),
  };
}

/**
 * Sends one recipient their copy, with an unsubscribe link for that report and address only.
 * Returns whether Resend accepted it. A system notice the account owner asked for, so it leaves
 * from the system sender rather than the lifecycle one.
 */
export function sendScheduledReportEmail({
  reportId,
  email,
  content,
}: SendScheduledReportInput): Promise<boolean> {
  const recipientId = scheduledReportRecipientId(reportId, email);
  return sendEmail({
    template: "scheduled-report",
    recipientId: null,
    to: email,
    essential: false,
    from: EMAIL_FROM_SYSTEM,
    subject: scheduledReportSubject(content),
    react: ScheduledReportEmail(scheduledReportEmailProps(reportId, email, content)),
    headers: buildUnsubscribeHeaders(recipientId, env.EMAIL_UNSUBSCRIBE_SECRET, "scheduled-report"),
    context: { reportId },
  });
}
