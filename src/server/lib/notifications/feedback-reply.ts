import FeedbackReplyEmail from "@/emails/feedback-reply";
import { SUPPORT_EMAIL } from "@/lib/constants/app";

import { sendEmail } from "./send-email";

export type SendFeedbackReplyEmailInput = {
  feedbackId: number;
  userId: string;
  toEmail: string;
  toName?: string | null;
  reply: string;
  originalMessage: string;
};

/** Resolves to false when the email could not be sent. */
export function sendFeedbackReplyEmail({
  feedbackId,
  userId,
  toEmail,
  toName,
  reply,
  originalMessage,
}: SendFeedbackReplyEmailInput): Promise<boolean> {
  return sendEmail({
    template: "feedback-reply",
    recipientId: userId,
    to: toEmail,
    essential: true,
    // Follow-ups from the user belong in the support inbox, not the sender's mailbox.
    reply_to: SUPPORT_EMAIL,
    subject: "Re: your feedback on iShortn",
    react: FeedbackReplyEmail({ userName: toName, reply, originalMessage }),
    context: { feedbackId },
  });
}
