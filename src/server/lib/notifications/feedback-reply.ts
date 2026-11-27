import FeedbackReplyEmail from "@/emails/feedback-reply";

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
    subject: "Re: your feedback on iShortn",
    react: FeedbackReplyEmail({ userName: toName, reply, originalMessage }),
    context: { feedbackId },
  });
}
